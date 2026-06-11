import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/connection";
import { type PaymentIntent, paymentIntent } from "@/lib/db/schema";

// Widget `data` payload echoed back by CloudPayments in webhook `Data`.
// Subscriptions pass { sessionId, planName }; top-ups pass { kind, sessionId }.
export type TopupWebhookData = {
  kind?: string;
  sessionId?: string;
  planName?: string;
};

/**
 * Resolve a top-up payment intent referenced by webhook Data. Returns null
 * when the session does not exist, belongs to another user, or is not a
 * top-up — callers treat null as "not a top-up flow" or reject explicitly.
 */
export async function findTopupIntent(
  sessionId: string,
  accountId: string
): Promise<PaymentIntent | null> {
  const [intent] = await db
    .select()
    .from(paymentIntent)
    .where(
      and(
        eq(paymentIntent.sessionId, sessionId),
        eq(paymentIntent.userId, accountId),
        eq(paymentIntent.kind, "topup")
      )
    )
    .limit(1);

  return intent ?? null;
}

export function parseWebhookData<T extends object>(rawData?: string): T | null {
  if (!rawData) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawData);
    if (parsed && typeof parsed === "object") {
      return parsed as T;
    }
  } catch {
    return null;
  }

  return null;
}

export function toNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isNaN(value) ? null : value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}
