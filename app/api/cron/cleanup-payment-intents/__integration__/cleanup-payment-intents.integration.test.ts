import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/cron/cleanup-payment-intents/route";
import { POST as deliverWebhook } from "@/app/api/webhooks/cloudpayments/route";
import {
  closeDatabaseConnection,
  readBalance,
  readPaymentIntent,
  resetMoneyTables,
  seedCurrency,
  seedPaymentIntent,
  seedUserWithBalance,
  signedWebhookRequest,
} from "@/tests/integration/helpers";

type CleanupResponseBody = {
  expired: number;
  deleted: number;
  timestamp: string;
  message: string;
};

const CRON_SECRET = "integration-cron-secret";
const CRON_URL = "http://localhost/api/cron/cleanup-payment-intents";

const MILLISECONDS_PER_MINUTE = 60 * 1000;
const MILLISECONDS_PER_DAY = 24 * 60 * MILLISECONDS_PER_MINUTE;

const INTENT_AMOUNT_MAJOR = 500;
const INTENT_AMOUNT_MINOR = 50_000;
const PAYMENT_TRANSACTION_ID = 1001;
const REFUND_TRANSACTION_ID = 2001;

const minutesAgo = (minutes: number): Date =>
  new Date(Date.now() - minutes * MILLISECONDS_PER_MINUTE);

const daysAgo = (days: number): Date =>
  new Date(Date.now() - days * MILLISECONDS_PER_DAY);

/** Past the 30-day retention period. */
const beyondRetention = (): Date => daysAgo(31);

/** Still inside the 30-day retention period. */
const withinRetention = (): Date => daysAgo(29);

const runCleanup = async (): Promise<CleanupResponseBody> => {
  const response = await GET(
    new Request(CRON_URL, {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    })
  );

  // A failed run answers `{ error }`, so the count assertions catch it.
  return (await response.json()) as CleanupResponseBody;
};

describe("payment-intent cleanup cron against a real database", () => {
  beforeEach(async () => {
    vi.stubEnv("CRON_SECRET", CRON_SECRET);
    vi.spyOn(console, "log").mockReturnValue(undefined);
    vi.spyOn(console, "error").mockReturnValue(undefined);
    await resetMoneyTables();
    await seedCurrency();
  });

  afterAll(async () => {
    await closeDatabaseConnection();
  });

  it("changes nothing without the cron secret", async () => {
    // Arrange
    const userId = await seedUserWithBalance();
    const overdueIntent = await seedPaymentIntent({
      userId,
      kind: "topup",
      amount: INTENT_AMOUNT_MINOR,
      expiresAt: minutesAgo(5),
    });

    // Act
    const response = await GET(new Request(CRON_URL));

    // Assert
    expect(response.status).toBe(401);
    expect((await readPaymentIntent(overdueIntent.id)).status).toBe("pending");
  });

  it("marks a pending intent past its expiry as expired and keeps the row", async () => {
    // Arrange
    const userId = await seedUserWithBalance();
    const overdueIntent = await seedPaymentIntent({
      userId,
      kind: "topup",
      amount: INTENT_AMOUNT_MINOR,
      expiresAt: minutesAgo(5),
    });

    // Act
    const body = await runCleanup();

    // Assert
    expect(body).toMatchObject({ expired: 1, deleted: 0 });
    const intentAfter = await readPaymentIntent(overdueIntent.id);
    expect(intentAfter.status).toBe("expired");
    expect(intentAfter.updatedAt.getTime()).toBeGreaterThan(
      overdueIntent.updatedAt.getTime()
    );
  });

  it("leaves a fresh pending intent untouched", async () => {
    // Arrange
    const userId = await seedUserWithBalance();
    const freshIntent = await seedPaymentIntent({
      userId,
      kind: "topup",
      amount: INTENT_AMOUNT_MINOR,
    });

    // Act
    const body = await runCleanup();

    // Assert
    expect(body).toMatchObject({ expired: 0, deleted: 0 });
    expect(await readPaymentIntent(freshIntent.id)).toEqual(freshIntent);
  });

  it("keeps a succeeded intent older than 30 days", async () => {
    // Arrange
    const userId = await seedUserWithBalance();
    const paidIntent = await seedPaymentIntent({
      userId,
      kind: "topup",
      amount: INTENT_AMOUNT_MINOR,
      status: "succeeded",
      externalTransactionId: String(PAYMENT_TRANSACTION_ID),
      createdAt: beyondRetention(),
      expiresAt: beyondRetention(),
    });

    // Act
    const body = await runCleanup();

    // Assert
    expect(body).toMatchObject({ expired: 0, deleted: 0 });
    expect(await readPaymentIntent(paidIntent.id)).toEqual(paidIntent);
  });

  it("deletes expired and failed intents older than 30 days", async () => {
    // Arrange
    const userId = await seedUserWithBalance();
    const oldExpiredIntent = await seedPaymentIntent({
      userId,
      kind: "topup",
      amount: INTENT_AMOUNT_MINOR,
      status: "expired",
      createdAt: beyondRetention(),
      expiresAt: beyondRetention(),
    });
    const oldFailedIntent = await seedPaymentIntent({
      userId,
      kind: "subscription",
      amount: INTENT_AMOUNT_MINOR,
      status: "failed",
      createdAt: beyondRetention(),
      expiresAt: beyondRetention(),
    });

    // Act
    const body = await runCleanup();

    // Assert
    expect(body).toMatchObject({ expired: 0, deleted: 2 });
    expect(await readPaymentIntent(oldExpiredIntent.id)).toBeUndefined();
    expect(await readPaymentIntent(oldFailedIntent.id)).toBeUndefined();
  });

  it("keeps expired and failed intents younger than 30 days", async () => {
    // Arrange
    const userId = await seedUserWithBalance();
    const recentExpiredIntent = await seedPaymentIntent({
      userId,
      kind: "topup",
      amount: INTENT_AMOUNT_MINOR,
      status: "expired",
      createdAt: withinRetention(),
      expiresAt: withinRetention(),
    });
    const recentFailedIntent = await seedPaymentIntent({
      userId,
      kind: "topup",
      amount: INTENT_AMOUNT_MINOR,
      status: "failed",
      createdAt: withinRetention(),
      expiresAt: withinRetention(),
    });

    // Act
    const body = await runCleanup();

    // Assert
    expect(body).toMatchObject({ expired: 0, deleted: 0 });
    expect((await readPaymentIntent(recentExpiredIntent.id)).status).toBe(
      "expired"
    );
    expect((await readPaymentIntent(recentFailedIntent.id)).status).toBe(
      "failed"
    );
  });

  it("expires and deletes an abandoned pending intent older than 30 days in one run", async () => {
    // Arrange
    const userId = await seedUserWithBalance();
    const abandonedIntent = await seedPaymentIntent({
      userId,
      kind: "topup",
      amount: INTENT_AMOUNT_MINOR,
      createdAt: beyondRetention(),
      expiresAt: beyondRetention(),
    });

    // Act
    const body = await runCleanup();

    // Assert
    expect(body).toMatchObject({ expired: 1, deleted: 1 });
    expect(await readPaymentIntent(abandonedIntent.id)).toBeUndefined();
  });

  it("keeps a processing intent older than 30 days", async () => {
    // Arrange
    const userId = await seedUserWithBalance();
    const processingIntent = await seedPaymentIntent({
      userId,
      kind: "topup",
      amount: INTENT_AMOUNT_MINOR,
      status: "processing",
      createdAt: beyondRetention(),
      expiresAt: beyondRetention(),
    });

    // Act
    const body = await runCleanup();

    // Assert
    expect(body).toMatchObject({ expired: 0, deleted: 0 });
    expect(await readPaymentIntent(processingIntent.id)).toEqual(
      processingIntent
    );
  });

  it("keeps an old failed intent that carries a payment transaction id", async () => {
    // Arrange: a failed renewal charge flips the paid purchase intent to
    // `failed` (the fail webhook matches it by the echoed session id).
    const userId = await seedUserWithBalance();
    const paidThenFailedIntent = await seedPaymentIntent({
      userId,
      kind: "subscription",
      amount: INTENT_AMOUNT_MINOR,
      status: "failed",
      externalTransactionId: String(PAYMENT_TRANSACTION_ID),
      createdAt: beyondRetention(),
      expiresAt: beyondRetention(),
    });

    // Act
    const body = await runCleanup();

    // Assert
    expect(body).toMatchObject({ expired: 0, deleted: 0 });
    expect(await readPaymentIntent(paidThenFailedIntent.id)).toEqual(
      paidThenFailedIntent
    );
  });

  it("still applies a refund of a payment older than 30 days after the cleanup", async () => {
    // Arrange
    const userId = await seedUserWithBalance({
      topupAmount: INTENT_AMOUNT_MINOR,
    });
    await seedPaymentIntent({
      userId,
      kind: "topup",
      amount: INTENT_AMOUNT_MINOR,
      status: "succeeded",
      externalTransactionId: String(PAYMENT_TRANSACTION_ID),
      createdAt: beyondRetention(),
      expiresAt: beyondRetention(),
    });

    // Act
    const cleanupBody = await runCleanup();
    const refundResponse = await deliverWebhook(
      signedWebhookRequest("refund", {
        TransactionId: REFUND_TRANSACTION_ID,
        PaymentTransactionId: PAYMENT_TRANSACTION_ID,
        Amount: INTENT_AMOUNT_MAJOR,
        AccountId: userId,
      })
    );

    // Assert
    expect(cleanupBody).toMatchObject({ expired: 0, deleted: 0 });
    expect(await refundResponse.json()).toEqual({ code: 0 });
    expect((await readBalance(userId)).topupAmount).toBe(0);
  });
});
