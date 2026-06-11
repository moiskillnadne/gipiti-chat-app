import { eq } from "drizzle-orm";
import { getMinorUnits } from "@/lib/billing/currencies";
import { minorToMajorUnits } from "@/lib/billing/money";
import {
  getActiveUserSubscription,
  priceForCurrency,
} from "@/lib/billing/subscriptions";
import { db } from "@/lib/db/connection";
import { getUserById } from "@/lib/db/query/user/get-by-id";
import { subscription, userSubscription } from "@/lib/db/schema";
import {
  createSubscription,
  getSubscription,
} from "@/lib/payments/cloudpayments";
import type { CloudPaymentsInterval } from "@/lib/payments/cloudpayments-types";

export type ResumeOutcome =
  /** A fresh CloudPayments recurring subscription was created. */
  | "resumed"
  /** Nothing to do — the subscription was never pending cancellation. */
  | "already_active"
  /**
   * Cancellation flags cleared without touching CloudPayments — either the
   * CP subscription is still active, or the row has no card token (non-CP
   * test subscriptions renewed by cron).
   */
  | "flags_cleared"
  /** The paid period already ended — the user must re-subscribe. */
  | "expired"
  /** CloudPayments rejected or failed the subscription create call. */
  | "cp_failed";

export type ResumeResult = {
  outcome: ResumeOutcome;
};

function resolveRecurrentInterval(
  billingPeriod: string,
  billingPeriodCount: number
): { interval: CloudPaymentsInterval; period: number } {
  switch (billingPeriod) {
    case "daily":
      return { interval: "Day", period: billingPeriodCount };
    case "weekly":
      return { interval: "Week", period: billingPeriodCount };
    case "annual":
      return { interval: "Month", period: 12 * billingPeriodCount };
    default:
      return { interval: "Month", period: billingPeriodCount };
  }
}

async function clearCancellationFlags(rowId: string): Promise<void> {
  await db
    .update(userSubscription)
    .set({ cancelAtPeriodEnd: false, cancelledAt: null, updatedAt: new Date() })
    .where(eq(userSubscription.id, rowId));
}

/**
 * Re-enables auto-renewal for a soft-cancelled subscription. CloudPayments
 * subscriptions cannot be reactivated after cancellation, so a new recurring
 * subscription is created from the stored card token with its first charge
 * at the current period boundary. The renewal then flows through the regular
 * `pay`/`recurrent` webhooks, which resolve the row by the new external id.
 */
export async function resumeSubscription(
  userId: string
): Promise<ResumeResult> {
  const row = await getActiveUserSubscription(userId);
  if (!row) {
    // The cleanup-cancelled cron already flipped the row to a terminal state.
    return { outcome: "expired" };
  }
  if (!row.cancelAtPeriodEnd) {
    return { outcome: "already_active" };
  }
  if (row.currentPeriodEnd.getTime() <= Date.now()) {
    // CP requires a future StartDate; the period boundary has passed.
    return { outcome: "expired" };
  }

  // If CloudPayments never actually cancelled (e.g. the cancel flag came from
  // a webhook race), clearing our flags is enough — keep the existing CP id.
  if (row.externalSubscriptionId) {
    try {
      const current = await getSubscription(row.externalSubscriptionId);
      if (current.Success && current.Model.Status === "Active") {
        await clearCancellationFlags(row.id);
        return { outcome: "flags_cleared" };
      }
    } catch {
      // CP lookup failed — fall through to creating a fresh subscription.
    }
  }

  if (!row.cardToken) {
    await clearCancellationFlags(row.id);
    return { outcome: "flags_cleared" };
  }

  const [userRecord, catalogRows, priceMinor, minorUnits] = await Promise.all([
    getUserById(userId),
    db
      .select()
      .from(subscription)
      .where(eq(subscription.id, row.subscriptionId))
      .limit(1),
    priceForCurrency(row.subscriptionId, row.currencyCode),
    getMinorUnits(row.currencyCode),
  ]);

  const catalog = catalogRows[0];
  if (!(userRecord?.email && catalog) || priceMinor == null) {
    console.error("Resume subscription: missing user/catalog/price data", {
      userId,
      subscriptionId: row.subscriptionId,
    });
    return { outcome: "cp_failed" };
  }

  const { interval, period } = resolveRecurrentInterval(
    catalog.billingPeriod,
    catalog.billingPeriodCount
  );

  // CloudPayments expects a UTC datetime without timezone suffix.
  const startDate = row.currentPeriodEnd.toISOString().slice(0, 19);

  try {
    const response = await createSubscription({
      token: row.cardToken,
      accountId: userId,
      description: `Подписка ${catalog.displayName ?? catalog.code}`,
      email: userRecord.email,
      amount: minorToMajorUnits(priceMinor, minorUnits),
      currency: row.currencyCode,
      requireConfirmation: false,
      startDate,
      interval,
      period,
    });

    if (!(response.Success && response.Model?.Id)) {
      console.error(
        "CloudPayments subscription create failed on resume:",
        response.Message
      );
      return { outcome: "cp_failed" };
    }

    console.log("Subscription resumed via new CloudPayments subscription:", {
      userId,
      externalSubscriptionId: response.Model.Id,
      requestedStartDate: startDate,
      startDateIso: response.Model.StartDateIso,
    });

    await db
      .update(userSubscription)
      .set({
        externalSubscriptionId: response.Model.Id,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        updatedAt: new Date(),
      })
      .where(eq(userSubscription.id, row.id));

    return { outcome: "resumed" };
  } catch (error) {
    console.error("Failed to resume subscription:", error);
    return { outcome: "cp_failed" };
  }
}
