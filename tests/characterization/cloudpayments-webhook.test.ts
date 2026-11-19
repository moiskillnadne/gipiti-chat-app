import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  creditTopupForIntent,
  ensureBalance,
  resetSubscriptionPool,
} from "@/lib/billing/balance";
import { getMinorUnits } from "@/lib/billing/currencies";
import { applyPaymentRefund } from "@/lib/billing/refund";
import {
  getSubscriptionByCode,
  priceForCurrency,
} from "@/lib/billing/subscriptions";
import type { PaymentIntent, Subscription } from "@/server/db/schema";
import { cancelSubscription } from "@/lib/payments/cloudpayments";
import { getCloudPaymentsConfig } from "@/lib/payments/cloudpayments-config";

import { cloudPaymentsWebhookPost } from "./targets/cloudpayments-webhook";

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

vi.mock("@/lib/payments/cloudpayments-config", () => ({
  getCloudPaymentsConfig: vi.fn(),
}));
vi.mock("@/server/db/connection", () => ({ db: dbMock }));
vi.mock("@/lib/db/query/user/get-by-id", () => ({ getUserById: vi.fn() }));
vi.mock("@/lib/billing/balance", () => ({
  creditTopupForIntent: vi.fn(),
  ensureBalance: vi.fn(),
  resetSubscriptionPool: vi.fn(),
}));
vi.mock("@/lib/billing/subscriptions", () => ({
  getSubscriptionByCode: vi.fn(),
  priceForCurrency: vi.fn(),
}));
vi.mock("@/lib/billing/currencies", () => ({ getMinorUnits: vi.fn() }));
vi.mock("@/lib/billing/refund", () => ({ applyPaymentRefund: vi.fn() }));
vi.mock("@/lib/payments/cloudpayments", () => ({
  cancelSubscription: vi.fn(),
}));

const WEBHOOK_URL = "http://localhost/api/webhooks/cloudpayments";
const API_SECRET = "characterization-api-secret";
const JSON_CONTENT_TYPE = "application/json";
const FORM_CONTENT_TYPE = "application/x-www-form-urlencoded";

const ACCOUNT_ID = "user-1";
const PLAN_CODE = "basic_monthly";
const PLAN_PRICE_MINOR = 49_900;
const PLAN_PRICE_MAJOR = 499;
const TOPUP_SESSION_ID = "tu_session";
const TOPUP_AMOUNT_MINOR = 100_000;
const TOPUP_AMOUNT_MAJOR = 1000;
const PAYMENT_TRANSACTION_ID = 123;
const REFUND_TRANSACTION_ID = 900;
const RUB_MINOR_UNITS = 2;

const CODE_ACCEPTED = 0;
const CODE_UNKNOWN_ACCOUNT = 10;
const CODE_REJECTED = 13;

type WebhookFields = Record<string, string | number>;

type WebhookRequestInput = {
  type?: string;
  rawBody: string;
  contentType?: string;
  /** `null` omits the `Content-HMAC` header altogether. */
  signature?: string | null;
};

/** The header CloudPayments sends: base64 HMAC-SHA256 of the raw body. */
const sign = (rawBody: string): string =>
  createHmac("sha256", API_SECRET).update(rawBody).digest("base64");

const createWebhookRequest = ({
  type,
  rawBody,
  contentType = JSON_CONTENT_TYPE,
  signature = sign(rawBody),
}: WebhookRequestInput): Request => {
  const headers = new Headers({ "content-type": contentType });
  if (signature !== null) {
    headers.set("Content-HMAC", signature);
  }

  const url = type === undefined ? WEBHOOK_URL : `${WEBHOOK_URL}?type=${type}`;

  return new Request(url, { method: "POST", headers, body: rawBody });
};

const toFormBody = (fields: WebhookFields): string =>
  new URLSearchParams(
    Object.entries(fields).map(([name, value]) => [name, String(value)])
  ).toString();

const postSignedJson = (
  type: string,
  fields: WebhookFields
): Promise<Response> =>
  cloudPaymentsWebhookPost(
    createWebhookRequest({ type, rawBody: JSON.stringify(fields) })
  );

const paymentIntentRow = (
  overrides: Partial<PaymentIntent> = {}
): PaymentIntent => ({
  id: "intent-1",
  sessionId: TOPUP_SESSION_ID,
  userId: ACCOUNT_ID,
  kind: "topup",
  subscriptionId: null,
  currencyCode: "RUB",
  amount: TOPUP_AMOUNT_MINOR,
  status: "pending",
  externalTransactionId: null,
  externalSubscriptionId: null,
  failureReason: null,
  metadata: null,
  expiresAt: new Date("2030-01-01T00:30:00.000Z"),
  createdAt: new Date("2030-01-01T00:00:00.000Z"),
  updatedAt: new Date("2030-01-01T00:00:00.000Z"),
  ...overrides,
});

const subscriptionRow = (code: string): Subscription =>
  ({
    id: `sub-${code}`,
    code,
    isActive: true,
    billingPeriod: "monthly",
    billingPeriodCount: 1,
  }) as Subscription;

const topupPayFields = (): WebhookFields => ({
  AccountId: ACCOUNT_ID,
  Amount: TOPUP_AMOUNT_MAJOR,
  Currency: "RUB",
  TransactionId: PAYMENT_TRANSACTION_ID,
  Data: JSON.stringify({ kind: "topup", sessionId: TOPUP_SESSION_ID }),
});

const subscriptionPayFields = (): WebhookFields => ({
  AccountId: ACCOUNT_ID,
  Amount: PLAN_PRICE_MAJOR,
  Currency: "RUB",
  TransactionId: PAYMENT_TRANSACTION_ID,
  Data: JSON.stringify({ planName: PLAN_CODE, sessionId: "ps_session" }),
});

const refundFields = (): WebhookFields => ({
  AccountId: ACCOUNT_ID,
  Amount: TOPUP_AMOUNT_MAJOR,
  TransactionId: REFUND_TRANSACTION_ID,
  PaymentTransactionId: PAYMENT_TRANSACTION_ID,
});

/** How many reads and writes reached the database fake. */
const countDatabaseCalls = (): number =>
  dbMock.select.mock.calls.length +
  dbMock.insert.mock.calls.length +
  dbMock.update.mock.calls.length;

beforeEach(() => {
  vi.clearAllMocks();
  selectResults.length = 0;

  vi.mocked(getCloudPaymentsConfig).mockReturnValue({
    publicId: "pk_characterization",
    apiSecret: API_SECRET,
  });
  vi.mocked(ensureBalance).mockResolvedValue({
    currencyCode: "RUB",
    subscriptionAmount: 0,
    topupAmount: 0,
    total: 0,
  });
  vi.mocked(getMinorUnits).mockResolvedValue(RUB_MINOR_UNITS);
  vi.mocked(getSubscriptionByCode).mockResolvedValue(
    subscriptionRow(PLAN_CODE)
  );
  vi.mocked(priceForCurrency).mockResolvedValue(PLAN_PRICE_MINOR);
  vi.mocked(creditTopupForIntent).mockResolvedValue({
    amount: TOPUP_AMOUNT_MINOR,
    subscriptionBalanceAfter: 0,
    topupBalanceAfter: TOPUP_AMOUNT_MINOR,
    transactionId: "txn-1",
  });
});

describe("CloudPayments webhook: request gate", () => {
  it.each([
    ["no type parameter", undefined],
    ["an unknown type", "chargeback"],
  ])("answers 400 for %s without reading the request", async (_label, type) => {
    // Arrange
    const request = createWebhookRequest({
      type,
      rawBody: JSON.stringify(topupPayFields()),
    });

    // Act
    const response = await cloudPaymentsWebhookPost(request);

    // Assert
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Missing or invalid webhook type",
    });
    expect(request.bodyUsed).toBe(false);
    expect(getCloudPaymentsConfig).not.toHaveBeenCalled();
    expect(countDatabaseCalls()).toBe(0);
  });

  it("answers 401 with code 13 when the Content-HMAC header is missing", async () => {
    // Arrange
    const request = createWebhookRequest({
      type: "pay",
      rawBody: JSON.stringify(topupPayFields()),
      signature: null,
    });

    // Act
    const response = await cloudPaymentsWebhookPost(request);

    // Assert: refused before the secret is even read.
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: CODE_REJECTED });
    expect(getCloudPaymentsConfig).not.toHaveBeenCalled();
    expect(countDatabaseCalls()).toBe(0);
    expect(creditTopupForIntent).not.toHaveBeenCalled();
  });

  it.each([
    ["the signature of a different body", sign("another body")],
    ["a signature of the wrong length", "bm90LWEtZGlnZXN0"],
  ])("answers 401 with code 13 for %s", async (_label, signature) => {
    // Arrange
    const request = createWebhookRequest({
      type: "pay",
      rawBody: JSON.stringify(topupPayFields()),
      signature,
    });

    // Act
    const response = await cloudPaymentsWebhookPost(request);

    // Assert
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: CODE_REJECTED });
    expect(countDatabaseCalls()).toBe(0);
    expect(creditTopupForIntent).not.toHaveBeenCalled();
  });

  it("answers code 13 with HTTP 200 for a signed body that cannot be parsed", async () => {
    // Arrange
    const request = createWebhookRequest({ type: "pay", rawBody: "{not json" });

    // Act
    const response = await cloudPaymentsWebhookPost(request);

    // Assert
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ code: CODE_REJECTED });
    expect(countDatabaseCalls()).toBe(0);
  });

  it.each([
    ["Status", { Id: "sc_subscription", AccountId: ACCOUNT_ID }],
    ["Id", { Status: "Active", AccountId: ACCOUNT_ID }],
  ])(
    "answers 400 with code 13 for a recurrent payload without %s",
    async (_label, fields) => {
      // Act
      const response = await postSignedJson("recurrent", fields);

      // Assert
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ code: CODE_REJECTED });
      expect(countDatabaseCalls()).toBe(0);
    }
  );
});

describe("CloudPayments webhook: pay for a top-up", () => {
  // Query order: the top-up intent of the session, then the intent that
  // already carries this external transaction id.
  it.each([
    ["JSON", JSON_CONTENT_TYPE, JSON.stringify(topupPayFields())],
    ["form-urlencoded", FORM_CONTENT_TYPE, toFormBody(topupPayFields())],
  ])(
    "credits a pending top-up intent delivered as %s",
    async (_label, contentType, rawBody) => {
      // Arrange
      const intent = paymentIntentRow();
      selectResults.push([intent], []);

      // Act
      const response = await cloudPaymentsWebhookPost(
        createWebhookRequest({ type: "pay", rawBody, contentType })
      );

      // Assert
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ code: CODE_ACCEPTED });
      expect(creditTopupForIntent).toHaveBeenCalledTimes(1);
      expect(creditTopupForIntent).toHaveBeenCalledWith({
        intent,
        externalTransactionId: String(PAYMENT_TRANSACTION_ID),
      });
      expect(resetSubscriptionPool).not.toHaveBeenCalled();
      expect(getSubscriptionByCode).not.toHaveBeenCalled();
    }
  );

  it.each([
    [
      "the intent is already succeeded",
      [paymentIntentRow({ status: "succeeded" })],
      [],
    ],
    [
      "the external transaction id already succeeded",
      [paymentIntentRow()],
      [{ status: "succeeded" }],
    ],
  ])(
    "acknowledges without crediting when %s",
    async (_label, sessionIntents, transactionIntents) => {
      // Arrange
      selectResults.push(sessionIntents, transactionIntents);

      // Act
      const response = await postSignedJson("pay", topupPayFields());

      // Assert
      expect(await response.json()).toEqual({ code: CODE_ACCEPTED });
      expect(creditTopupForIntent).not.toHaveBeenCalled();
      expect(dbMock.update).not.toHaveBeenCalled();
    }
  );

  it("acknowledges when a concurrent delivery already credited the intent", async () => {
    // Arrange
    selectResults.push([paymentIntentRow()], []);
    vi.mocked(creditTopupForIntent).mockResolvedValue(null);

    // Act
    const response = await postSignedJson("pay", topupPayFields());

    // Assert
    expect(await response.json()).toEqual({ code: CODE_ACCEPTED });
    expect(creditTopupForIntent).toHaveBeenCalledTimes(1);
  });
});

describe("CloudPayments webhook: pay for a subscription", () => {
  it("activates the plan and resets the subscription pool as a purchase", async () => {
    // Arrange: no top-up intent, no intent for the transaction, the user
    // row, then no intent for the widget session.
    selectResults.push([], [], [{ id: ACCOUNT_ID, isTester: false }], []);

    // Act
    const response = await postSignedJson("pay", subscriptionPayFields());

    // Assert
    expect(await response.json()).toEqual({ code: CODE_ACCEPTED });
    expect(resetSubscriptionPool).toHaveBeenCalledTimes(1);
    expect(resetSubscriptionPool).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "subscription_purchase",
        userId: ACCOUNT_ID,
        amount: PLAN_PRICE_MINOR,
        referenceId: String(PAYMENT_TRANSACTION_ID),
      })
    );
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: ACCOUNT_ID,
        subscriptionId: `sub-${PLAN_CODE}`,
        status: "active",
      })
    );
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "ps_session",
        kind: "subscription",
        status: "succeeded",
        amount: PLAN_PRICE_MINOR,
        externalTransactionId: String(PAYMENT_TRANSACTION_ID),
      })
    );
    // Leftover active subscriptions of the user are cancelled first.
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cancelled" })
    );
    expect(creditTopupForIntent).not.toHaveBeenCalled();
  });

  it("acknowledges without resetting the pool when the transaction already succeeded", async () => {
    // Arrange: no top-up intent, then a succeeded intent for the transaction.
    selectResults.push(
      [],
      [
        paymentIntentRow({
          kind: "subscription",
          status: "succeeded",
          externalTransactionId: String(PAYMENT_TRANSACTION_ID),
        }),
      ]
    );

    // Act
    const response = await postSignedJson("pay", subscriptionPayFields());

    // Assert
    expect(await response.json()).toEqual({ code: CODE_ACCEPTED });
    expect(resetSubscriptionPool).not.toHaveBeenCalled();
    expect(dbMock.insert).not.toHaveBeenCalled();
    expect(dbMock.update).not.toHaveBeenCalled();
  });
});

describe("CloudPayments webhook: refund", () => {
  it("passes the paid intent and both transaction ids to the refund and acknowledges a duplicate", async () => {
    // Arrange
    const intent = paymentIntentRow({
      status: "succeeded",
      externalTransactionId: String(PAYMENT_TRANSACTION_ID),
    });
    selectResults.push([intent]);
    vi.mocked(applyPaymentRefund).mockResolvedValue({
      status: "duplicate",
      isFullyRefunded: true,
    });

    // Act
    const response = await postSignedJson("refund", refundFields());

    // Assert
    expect(await response.json()).toEqual({ code: CODE_ACCEPTED });
    expect(applyPaymentRefund).toHaveBeenCalledTimes(1);
    expect(applyPaymentRefund).toHaveBeenCalledWith({
      intent,
      paymentTransactionId: String(PAYMENT_TRANSACTION_ID),
      refundTransactionId: String(REFUND_TRANSACTION_ID),
      refundAmount: TOPUP_AMOUNT_MINOR,
    });
  });

  it("acknowledges an applied top-up refund without cancelling any subscription", async () => {
    // Arrange
    selectResults.push([
      paymentIntentRow({
        status: "succeeded",
        externalTransactionId: String(PAYMENT_TRANSACTION_ID),
      }),
    ]);
    vi.mocked(applyPaymentRefund).mockResolvedValue({
      status: "applied",
      pool: "topup",
      debitAmount: TOPUP_AMOUNT_MINOR,
      isFullyRefunded: true,
      subscriptionBalanceAfter: 0,
      topupBalanceAfter: 0,
      transactionId: "txn-refund",
    });

    // Act
    const response = await postSignedJson("refund", refundFields());

    // Assert
    expect(await response.json()).toEqual({ code: CODE_ACCEPTED });
    expect(cancelSubscription).not.toHaveBeenCalled();
    expect(dbMock.update).not.toHaveBeenCalled();
  });
});

describe("CloudPayments webhook: check", () => {
  it("declines with code 10 when the account is not a known user", async () => {
    // Arrange: the user lookup finds nothing.
    selectResults.push([]);

    // Act
    const response = await postSignedJson("check", subscriptionPayFields());

    // Assert
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ code: CODE_UNKNOWN_ACCOUNT });
    expect(dbMock.select).toHaveBeenCalledTimes(1);
    expect(getSubscriptionByCode).not.toHaveBeenCalled();
  });
});
