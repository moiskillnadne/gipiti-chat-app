import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { getBalance } from "@/lib/billing/balance";
import { getMinorUnits } from "@/lib/billing/currencies";
import { formatCurrency } from "@/lib/billing/money";
import { db } from "@/lib/db/connection";
import { subscription, userSubscription } from "@/lib/db/schema";
import { getTranslations } from "@/lib/i18n/translate";
import {
  deriveSubscriptionUiState,
  type SubscriptionUiState,
} from "@/lib/subscription/subscription-state";
import {
  daysUntil,
  formatRelativeRu,
  formatRuDate,
  formatRuDayTime,
} from "@/lib/utils/format-billing";
import { DangerZoneStrip } from "./_components/danger-zone-strip";
import styles from "./_components/dashboard.module.css";
import { FreePlanCard } from "./_components/free-plan-card";
import { PlanCard, type PlanCardData } from "./_components/plan-card";
import { StatusBanner } from "./_components/status-banner";
import { SubscriptionHeader } from "./_components/subscription-header";
import { SubscriptionTopNav } from "./_components/subscription-top-nav";
import {
  type BalanceSummaryData,
  UsageGaugeCard,
} from "./_components/usage-gauge-card";

type BillingPeriodKey = "daily" | "weekly" | "monthly" | "annual";

const PRICE_SUFFIX_BY_PERIOD: Record<BillingPeriodKey, string> = {
  daily: "/день",
  weekly: "/нед",
  monthly: "/мес",
  annual: "/год",
};

const PERIOD_LABEL_KEY_BY_PERIOD: Record<BillingPeriodKey, string> = {
  daily: "daily",
  weekly: "weekly",
  monthly: "monthly",
  annual: "annual",
};

type LatestSubscription = {
  subscription: typeof userSubscription.$inferSelect;
  displayName: string | null;
  billingPeriod: BillingPeriodKey;
};

async function getLatestSubscription(
  userId: string
): Promise<LatestSubscription | null> {
  const [row] = await db
    .select({
      subscription: userSubscription,
      displayName: subscription.displayName,
      billingPeriod: subscription.billingPeriod,
    })
    .from(userSubscription)
    .innerJoin(
      subscription,
      eq(userSubscription.subscriptionId, subscription.id)
    )
    .where(eq(userSubscription.userId, userId))
    .orderBy(desc(userSubscription.currentPeriodEnd))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    subscription: row.subscription,
    displayName: row.displayName,
    billingPeriod: row.billingPeriod as BillingPeriodKey,
  };
}

export default async function SubscriptionPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const [latest, balanceSummary] = await Promise.all([
    getLatestSubscription(session.user.id),
    getBalance(session.user.id),
  ]);

  const subscriptionRow = latest?.subscription ?? null;
  const state: SubscriptionUiState = deriveSubscriptionUiState({
    subscription: subscriptionRow,
    plan: null,
  });

  const tPlan = await getTranslations("auth.subscription.dashboard.plan");
  const periodKey: BillingPeriodKey = latest?.billingPeriod ?? "monthly";
  const periodLabel = tPlan(
    `billingPeriod.${PERIOD_LABEL_KEY_BY_PERIOD[periodKey]}`
  );

  const now = new Date();
  const trialDaysLeft =
    state === "trial" && subscriptionRow?.trialEndsAt
      ? daysUntil(subscriptionRow.trialEndsAt, now)
      : 0;

  const currencyCode = balanceSummary?.currencyCode ?? "RUB";
  const minorUnits = balanceSummary ? await getMinorUnits(currencyCode) : 2;

  const balanceData: BalanceSummaryData | null = balanceSummary
    ? {
        currencyCode,
        subscriptionAmount: balanceSummary.subscriptionAmount,
        topupAmount: balanceSummary.topupAmount,
        total: balanceSummary.total,
        formattedTotal: formatCurrency(
          balanceSummary.total,
          currencyCode,
          minorUnits
        ),
        formattedSubscription: formatCurrency(
          balanceSummary.subscriptionAmount,
          currencyCode,
          minorUnits
        ),
        formattedTopup: formatCurrency(
          balanceSummary.topupAmount,
          currencyCode,
          minorUnits
        ),
      }
    : null;

  // Subscription price label derived from the last charged amount (1:1 with the
  // credited subscription balance). Falls back to an empty label when unknown.
  const formattedPrice = subscriptionRow?.lastPaymentAmount
    ? `${formatCurrency(Number(subscriptionRow.lastPaymentAmount), currencyCode, minorUnits)} ${PRICE_SUFFIX_BY_PERIOD[periodKey]}`
    : "";

  const lastPaymentText =
    subscriptionRow?.lastPaymentDate && subscriptionRow.lastPaymentAmount
      ? `${formatRuDate(subscriptionRow.lastPaymentDate)} · ${formatCurrency(Number(subscriptionRow.lastPaymentAmount), currencyCode, minorUnits)}`
      : null;

  const planDisplayName = latest?.displayName ?? "";

  const planCardData: PlanCardData | null =
    state === "none" || !subscriptionRow
      ? null
      : {
          displayName: planDisplayName,
          periodLabel,
          formattedPrice,
          nextPaymentDate: subscriptionRow.nextBillingDate
            ? formatRuDate(subscriptionRow.nextBillingDate)
            : null,
          lastPayment: lastPaymentText,
          cardMask: subscriptionRow.cardMask ?? null,
          accessUntilDate: subscriptionRow.currentPeriodEnd
            ? formatRuDate(subscriptionRow.currentPeriodEnd)
            : null,
          chargingStartDate: subscriptionRow.trialEndsAt
            ? formatRuDate(subscriptionRow.trialEndsAt)
            : null,
          nextRetryDate: subscriptionRow.nextBillingDate
            ? state === "past_due"
              ? formatRuDayTime(subscriptionRow.nextBillingDate, now)
              : formatRuDate(subscriptionRow.nextBillingDate)
            : null,
          pastDueLastAmount: subscriptionRow.lastPaymentAmount
            ? formatCurrency(
                Number(subscriptionRow.lastPaymentAmount),
                currencyCode,
                minorUnits
              )
            : null,
        };

  const pastDueRetryIn =
    state === "past_due" && subscriptionRow?.nextBillingDate
      ? formatRelativeRu(subscriptionRow.nextBillingDate, now)
      : null;

  const emailVerified = session.user.emailVerified === true;
  const dimmedCards = state === "cancelled" || state === "past_due";

  return (
    <>
      <SubscriptionTopNav state={state} />
      <main className={styles.body}>
        <SubscriptionHeader
          periodEnd={subscriptionRow?.currentPeriodEnd ?? null}
          periodStart={subscriptionRow?.currentPeriodStart ?? null}
          state={state}
          trialDaysLeft={trialDaysLeft}
        />

        <StatusBanner
          cancelCurrentPeriodEnd={subscriptionRow?.currentPeriodEnd ?? null}
          cancelEndDate={subscriptionRow?.currentPeriodEnd ?? null}
          pastDueCardMask={subscriptionRow?.cardMask ?? null}
          pastDuePriceLabel={formattedPrice}
          pastDueRetryIn={pastDueRetryIn}
          state={state}
          trialChargingStartDate={subscriptionRow?.trialEndsAt ?? null}
          trialDaysLeft={trialDaysLeft}
          trialPlanName={planDisplayName}
          trialPriceLabel={formattedPrice}
        />

        <div className={styles.grid}>
          <UsageGaugeCard
            balance={balanceData}
            dimmed={dimmedCards}
            state={state}
          />

          {state === "none" ? (
            <FreePlanCard
              email={session.user.email ?? ""}
              emailVerified={emailVerified}
              rewardAmountK={0}
            />
          ) : (
            planCardData && (
              <PlanCard
                data={planCardData}
                dimmed={dimmedCards}
                state={state}
              />
            )
          )}

          {state === "active" && subscriptionRow?.currentPeriodEnd && (
            <DangerZoneStrip
              currentPeriodEnd={subscriptionRow.currentPeriodEnd}
            />
          )}
        </div>
      </main>
    </>
  );
}
