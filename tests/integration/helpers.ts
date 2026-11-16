/**
 * Seeding and inspection helpers for the integration tests. They use the
 * app's own `db`, which the integration config points at the test database.
 */
import { createHmac, randomUUID } from "node:crypto";

import { asc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/connection";
import {
  type Balance,
  balance,
  currency,
  fxRate,
  type PaymentIntent,
  paymentIntent,
  subscription,
  type Transaction,
  transaction,
  type UserSubscription,
  user,
  userSubscription,
} from "@/lib/db/schema";

export const TEST_CURRENCY_CODE = "RUB";

const WEBHOOK_URL = "http://localhost/api/webhooks/cloudpayments";
const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export type WebhookType =
  | "check"
  | "pay"
  | "fail"
  | "recurrent"
  | "cancel"
  | "refund";

type SeedBalanceInput = {
  subscriptionAmount?: number;
  topupAmount?: number;
};

type SeedPaymentIntentInput = {
  userId: string;
  kind: PaymentIntent["kind"];
  amount: number;
  status?: PaymentIntent["status"];
  subscriptionId?: string;
  externalTransactionId?: string;
  externalSubscriptionId?: string;
  /** Defaults to 30 minutes from now. */
  expiresAt?: Date;
  /** Defaults to now. */
  createdAt?: Date;
};

type SeedUserSubscriptionInput = {
  userId: string;
  subscriptionId: string;
  externalSubscriptionId: string;
};

/**
 * Empty every table the money tests write. `CASCADE` follows the foreign keys
 * from `User` (balances, transactions, payment intents, user subscriptions,
 * chats). Catalog tables (`Currency`, `Subscription`) are left alone.
 */
export const resetMoneyTables = async (): Promise<void> => {
  await db.execute(sql`TRUNCATE TABLE ${user}, ${fxRate} CASCADE`);
};

/** Close the pool so the test worker can exit. Call from `afterAll`. */
export const closeDatabaseConnection = async (): Promise<void> => {
  await db.$client.end();
};

/** How many connections the app's pool may open at once. */
export const connectionPoolSize = (): number => db.$client.options.max;

export class DatabaseWorkHungError extends Error {
  constructor(timeoutMs: number) {
    super(
      `Database work did not settle within ${timeoutMs} ms: the connection pool is most likely exhausted by transactions that wait for a second connection. The pool was destroyed to release their row locks, so later tests in this file fail with CONNECTION_ENDED.`
    );
    this.name = "DatabaseWorkHungError";
  }
}

/**
 * Await database work that must not hang. When it has not settled after
 * `timeoutMs` the pool is destroyed and the returned promise rejects with
 * `DatabaseWorkHungError`.
 *
 * Destroying the pool is the point: hung transactions keep their connections
 * and row locks, and every later query would queue behind them until the test
 * runner gives up. Dropping the connections makes Postgres roll them back.
 */
export const settleWithinDeadline = async <Result>(
  work: Promise<Result>,
  timeoutMs: number
): Promise<Result> => {
  let deadlineTimer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    deadlineTimer = setTimeout(
      () => reject(new DatabaseWorkHungError(timeoutMs)),
      timeoutMs
    );
  });

  try {
    return await Promise.race([work, deadline]);
  } catch (error) {
    if (error instanceof DatabaseWorkHungError) {
      await db.$client.end({ timeout: 0 });
    }
    throw error;
  } finally {
    clearTimeout(deadlineTimer);
  }
};

export const seedCurrency = async (
  code: string = TEST_CURRENCY_CODE
): Promise<void> => {
  await db
    .insert(currency)
    .values({ code, name: `${code} (test)`, symbol: code, minorUnits: 2 })
    .onConflictDoNothing();
};

/** `rate` is quote-currency units per 1 USD. */
export const seedFxRate = async (
  rate: number,
  quoteCurrency: string = TEST_CURRENCY_CODE
): Promise<void> => {
  await db
    .insert(fxRate)
    .values({ quoteCurrency, rate: String(rate), source: "integration-test" });
};

/** Create a user with a balance row and return the user id. */
export const seedUserWithBalance = async ({
  subscriptionAmount = 0,
  topupAmount = 0,
}: SeedBalanceInput = {}): Promise<string> => {
  const [createdUser] = await db
    .insert(user)
    .values({ email: `integration-${randomUUID()}@example.test` })
    .returning({ id: user.id });

  await db.insert(balance).values({
    userId: createdUser.id,
    currencyCode: TEST_CURRENCY_CODE,
    subscriptionAmount,
    topupAmount,
  });

  return createdUser.id;
};

export const seedPaymentIntent = async ({
  userId,
  kind,
  amount,
  status = "pending",
  subscriptionId,
  externalTransactionId,
  externalSubscriptionId,
  expiresAt = new Date(Date.now() + THIRTY_MINUTES_MS),
  createdAt,
}: SeedPaymentIntentInput): Promise<PaymentIntent> => {
  const [intent] = await db
    .insert(paymentIntent)
    .values({
      sessionId: `it_${randomUUID().replaceAll("-", "")}`,
      userId,
      kind,
      subscriptionId,
      currencyCode: TEST_CURRENCY_CODE,
      amount,
      status,
      externalTransactionId,
      externalSubscriptionId,
      expiresAt,
      createdAt,
    })
    .returning();

  return intent;
};

/** Create a catalog plan with a unique code and return its id. */
export const seedSubscriptionPlan = async (): Promise<string> => {
  const [plan] = await db
    .insert(subscription)
    .values({ code: `integration_${randomUUID()}` })
    .returning({ id: subscription.id });

  return plan.id;
};

export const seedActiveUserSubscription = async ({
  userId,
  subscriptionId,
  externalSubscriptionId,
}: SeedUserSubscriptionInput): Promise<void> => {
  const now = new Date();
  const periodEnd = new Date(now.getTime() + THIRTY_DAYS_MS);

  await db.insert(userSubscription).values({
    userId,
    subscriptionId,
    currencyCode: TEST_CURRENCY_CODE,
    status: "active",
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    nextBillingDate: periodEnd,
    externalSubscriptionId,
  });
};

export const readBalance = async (userId: string): Promise<Balance> => {
  const [row] = await db
    .select()
    .from(balance)
    .where(eq(balance.userId, userId))
    .limit(1);

  return row;
};

export const readTransactions = async (
  userId: string
): Promise<Transaction[]> =>
  await db
    .select()
    .from(transaction)
    .where(eq(transaction.userId, userId))
    .orderBy(asc(transaction.createdAt));

export const readPaymentIntent = async (
  intentId: string
): Promise<PaymentIntent> => {
  const [row] = await db
    .select()
    .from(paymentIntent)
    .where(eq(paymentIntent.id, intentId))
    .limit(1);

  return row;
};

export const readUserSubscriptions = async (
  userId: string
): Promise<UserSubscription[]> =>
  await db
    .select()
    .from(userSubscription)
    .where(eq(userSubscription.userId, userId));

/**
 * A webhook request signed the way CloudPayments signs it: `Content-HMAC` is
 * the base64 HMAC-SHA256 of the raw body, keyed with the API secret.
 */
export const signedWebhookRequest = (
  type: WebhookType,
  payload: Record<string, unknown>
): Request => {
  const apiSecret = process.env.CLOUDPAYMENTS_API_SECRET;
  if (!apiSecret) {
    throw new Error("CLOUDPAYMENTS_API_SECRET is not set for the test run");
  }

  const body = JSON.stringify(payload);
  const signature = createHmac("sha256", apiSecret)
    .update(body)
    .digest("base64");

  return new Request(`${WEBHOOK_URL}?type=${type}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Content-HMAC": signature },
    body,
  });
};
