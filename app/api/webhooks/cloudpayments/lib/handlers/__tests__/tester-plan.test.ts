import { beforeEach, describe, expect, it, vi } from "vitest";

import { ensureBalance, resetSubscriptionPool } from "@/lib/billing/balance";
import {
  getSubscriptionByCode,
  priceForCurrency,
} from "@/lib/billing/subscriptions";
import type { Subscription } from "@/lib/db/schema";
import type { CloudPaymentsWebhookPayload } from "@/lib/payments/cloudpayments-types";

import { handleCheckWebhook } from "../check";
import { handlePayWebhook } from "../pay";

// Every `db.select()...limit()` call resolves the next queued row set, in
// the order the handler issues its queries.
const { selectResults, insertValues, updateSet, dbMock } = vi.hoisted(() => {
  const queuedSelectResults: unknown[][] = [];
  const insertValuesMock = vi.fn().mockResolvedValue(undefined);
  const updateSetMock = vi.fn(() => ({
    where: vi.fn().mockResolvedValue(undefined),
  }));

  const selectChain = {
    from: () => selectChain,
    innerJoin: () => selectChain,
    where: () => selectChain,
    limit: async () => queuedSelectResults.shift() ?? [],
  };

  return {
    selectResults: queuedSelectResults,
    insertValues: insertValuesMock,
    updateSet: updateSetMock,
    dbMock: {
      select: vi.fn(() => selectChain),
      insert: vi.fn(() => ({ values: insertValuesMock })),
      update: vi.fn(() => ({ set: updateSetMock })),
    },
  };
});

vi.mock("@/lib/db/connection", () => ({ db: dbMock }));
vi.mock("@/lib/billing/subscriptions", () => ({
  getSubscriptionByCode: vi.fn(),
  priceForCurrency: vi.fn(),
}));
vi.mock("@/lib/billing/balance", () => ({
  creditTopupForIntent: vi.fn(),
  ensureBalance: vi.fn(),
  resetSubscriptionPool: vi.fn(),
}));

const TESTER_PLAN_CODE = "tester_paid";
const PUBLIC_PLAN_CODE = "basic_monthly";
const PLAN_PRICE_MINOR = 500;
const ACCOUNT_ID = "user-1";
const CLOUDPAYMENTS_ACCEPTED = 0;
const CLOUDPAYMENTS_REJECTED_PLAN = 13;

const subscriptionRow = (code: string): Subscription =>
  ({
    id: `sub-${code}`,
    code,
    isActive: true,
    billingPeriod: "daily",
    billingPeriodCount: 1,
  }) as Subscription;

const webhookPayload = (planName: string): CloudPaymentsWebhookPayload =>
  ({
    AccountId: ACCOUNT_ID,
    Amount: PLAN_PRICE_MINOR / 100,
    Currency: "RUB",
    TransactionId: 123,
    Data: JSON.stringify({ planName, sessionId: "ps_session" }),
  }) as CloudPaymentsWebhookPayload;

const arrangePlan = (code: string): void => {
  vi.mocked(getSubscriptionByCode).mockResolvedValue(subscriptionRow(code));
  vi.mocked(priceForCurrency).mockResolvedValue(PLAN_PRICE_MINOR);
};

const responseCode = async (response: Response): Promise<number> => {
  const body: { code: number } = await response.json();
  return body.code;
};

beforeEach(() => {
  vi.clearAllMocks();
  selectResults.length = 0;
  vi.mocked(ensureBalance).mockResolvedValue({
    currencyCode: "RUB",
  } as Awaited<ReturnType<typeof ensureBalance>>);
});

describe("check webhook: tester-only plans", () => {
  // Query order in check: user row, then the top-up intent for the session.
  const queueCheckQueries = (isTester: boolean): void => {
    selectResults.push([{ id: ACCOUNT_ID, isTester }], []);
  };

  it("declines a tester-only plan for a user who is not a tester", async () => {
    // Arrange
    queueCheckQueries(false);
    arrangePlan(TESTER_PLAN_CODE);

    // Act
    const response = await handleCheckWebhook(webhookPayload(TESTER_PLAN_CODE));

    // Assert
    expect(await responseCode(response)).toBe(CLOUDPAYMENTS_REJECTED_PLAN);
  });

  it("accepts a tester-only plan for a tester", async () => {
    queueCheckQueries(true);
    arrangePlan(TESTER_PLAN_CODE);

    const response = await handleCheckWebhook(webhookPayload(TESTER_PLAN_CODE));

    expect(await responseCode(response)).toBe(CLOUDPAYMENTS_ACCEPTED);
  });

  it("accepts a public plan for a user who is not a tester", async () => {
    queueCheckQueries(false);
    arrangePlan(PUBLIC_PLAN_CODE);

    const response = await handleCheckWebhook(webhookPayload(PUBLIC_PLAN_CODE));

    expect(await responseCode(response)).toBe(CLOUDPAYMENTS_ACCEPTED);
  });
});

describe("pay webhook: tester-only plans", () => {
  // Query order in pay (no SubscriptionId): top-up intent, transaction
  // intent, user row, then the session intent while recording the payment.
  const queuePayQueries = (isTester: boolean): void => {
    selectResults.push([], [], [{ id: ACCOUNT_ID, isTester }], []);
  };

  it("does not activate a tester-only plan for a user who is not a tester", async () => {
    // Arrange
    queuePayQueries(false);
    arrangePlan(TESTER_PLAN_CODE);

    // Act
    const response = await handlePayWebhook(webhookPayload(TESTER_PLAN_CODE));

    // Assert: acknowledged so CloudPayments stops retrying, nothing written.
    expect(await responseCode(response)).toBe(CLOUDPAYMENTS_ACCEPTED);
    expect(dbMock.insert).not.toHaveBeenCalled();
    expect(dbMock.update).not.toHaveBeenCalled();
    expect(resetSubscriptionPool).not.toHaveBeenCalled();
  });

  it("activates a tester-only plan for a tester", async () => {
    queuePayQueries(true);
    arrangePlan(TESTER_PLAN_CODE);

    const response = await handlePayWebhook(webhookPayload(TESTER_PLAN_CODE));

    expect(await responseCode(response)).toBe(CLOUDPAYMENTS_ACCEPTED);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: ACCOUNT_ID,
        subscriptionId: `sub-${TESTER_PLAN_CODE}`,
        status: "active",
      })
    );
    expect(resetSubscriptionPool).toHaveBeenCalledWith(
      expect.objectContaining({ userId: ACCOUNT_ID, amount: PLAN_PRICE_MINOR })
    );
    expect(updateSet).toHaveBeenCalled();
  });

  it("activates a public plan for a user who is not a tester", async () => {
    queuePayQueries(false);
    arrangePlan(PUBLIC_PLAN_CODE);

    const response = await handlePayWebhook(webhookPayload(PUBLIC_PLAN_CODE));

    expect(await responseCode(response)).toBe(CLOUDPAYMENTS_ACCEPTED);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionId: `sub-${PUBLIC_PLAN_CODE}`,
        status: "active",
      })
    );
  });
});
