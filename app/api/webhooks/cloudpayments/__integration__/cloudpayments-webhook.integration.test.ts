import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { POST } from "@/app/api/webhooks/cloudpayments/route";
import {
  closeDatabaseConnection,
  readBalance,
  readPaymentIntent,
  readTransactions,
  readUserSubscriptions,
  resetMoneyTables,
  seedActiveUserSubscription,
  seedCurrency,
  seedPaymentIntent,
  seedSubscriptionPlan,
  seedUserWithBalance,
  signedWebhookRequest,
} from "@/tests/integration/helpers";

type TopupPayInput = {
  userId: string;
  sessionId: string;
  transactionId: number;
  amountMajor: number;
};

type RefundInput = {
  userId: string;
  refundTransactionId: number;
  paymentTransactionId: number;
  amountMajor: number;
};

const TOPUP_AMOUNT_MAJOR = 500;
const TOPUP_AMOUNT_MINOR = 50_000;
const PAYMENT_TRANSACTION_ID = 1001;
const REFUND_TRANSACTION_ID = 2001;

const deliverTopupPay = async ({
  userId,
  sessionId,
  transactionId,
  amountMajor,
}: TopupPayInput): Promise<unknown> => {
  const response = await POST(
    signedWebhookRequest("pay", {
      TransactionId: transactionId,
      Amount: amountMajor,
      Currency: "RUB",
      AccountId: userId,
      Status: "Completed",
      Data: JSON.stringify({ kind: "topup", sessionId }),
    })
  );
  return await response.json();
};

const deliverRefund = async ({
  userId,
  refundTransactionId,
  paymentTransactionId,
  amountMajor,
}: RefundInput): Promise<unknown> => {
  const response = await POST(
    signedWebhookRequest("refund", {
      TransactionId: refundTransactionId,
      PaymentTransactionId: paymentTransactionId,
      Amount: amountMajor,
      AccountId: userId,
    })
  );
  return await response.json();
};

describe("CloudPayments webhook against a real database", () => {
  beforeEach(async () => {
    await resetMoneyTables();
    await seedCurrency();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await closeDatabaseConnection();
  });

  describe("top-up payment", () => {
    it("credits the top-up pool once when the notification is delivered twice", async () => {
      // Arrange
      const userId = await seedUserWithBalance({ topupAmount: 1000 });
      const intent = await seedPaymentIntent({
        userId,
        kind: "topup",
        amount: TOPUP_AMOUNT_MINOR,
      });
      const delivery: TopupPayInput = {
        userId,
        sessionId: intent.sessionId,
        transactionId: PAYMENT_TRANSACTION_ID,
        amountMajor: TOPUP_AMOUNT_MAJOR,
      };

      // Act
      const firstBody = await deliverTopupPay(delivery);
      const secondBody = await deliverTopupPay(delivery);

      // Assert
      expect(firstBody).toEqual({ code: 0 });
      expect(secondBody).toEqual({ code: 0 });
      expect((await readBalance(userId)).topupAmount).toBe(
        1000 + TOPUP_AMOUNT_MINOR
      );

      const transactions = await readTransactions(userId);
      expect(transactions).toHaveLength(1);
      expect(transactions[0]).toMatchObject({
        type: "topup_purchase",
        pool: "topup",
        amount: TOPUP_AMOUNT_MINOR,
        referenceId: intent.id,
      });

      const intentAfter = await readPaymentIntent(intent.id);
      expect(intentAfter.status).toBe("succeeded");
      expect(intentAfter.externalTransactionId).toBe(
        String(PAYMENT_TRANSACTION_ID)
      );
    });

    it("credits once when two deliveries of the same notification race", async () => {
      // Arrange
      const userId = await seedUserWithBalance();
      const intent = await seedPaymentIntent({
        userId,
        kind: "topup",
        amount: TOPUP_AMOUNT_MINOR,
      });
      const delivery: TopupPayInput = {
        userId,
        sessionId: intent.sessionId,
        transactionId: PAYMENT_TRANSACTION_ID,
        amountMajor: TOPUP_AMOUNT_MAJOR,
      };

      // Act
      const bodies = await Promise.all([
        deliverTopupPay(delivery),
        deliverTopupPay(delivery),
      ]);

      // Assert
      expect(bodies).toEqual([{ code: 0 }, { code: 0 }]);
      expect((await readBalance(userId)).topupAmount).toBe(TOPUP_AMOUNT_MINOR);
      expect(await readTransactions(userId)).toHaveLength(1);
    });

    it("does not credit when the charged amount differs from the intent", async () => {
      // Arrange
      const userId = await seedUserWithBalance();
      const intent = await seedPaymentIntent({
        userId,
        kind: "topup",
        amount: TOPUP_AMOUNT_MINOR,
      });

      // Act
      const body = await deliverTopupPay({
        userId,
        sessionId: intent.sessionId,
        transactionId: PAYMENT_TRANSACTION_ID,
        amountMajor: TOPUP_AMOUNT_MAJOR + 1,
      });

      // Assert
      expect(body).toEqual({ code: 0 });
      expect((await readBalance(userId)).topupAmount).toBe(0);
      expect(await readTransactions(userId)).toHaveLength(0);
      expect((await readPaymentIntent(intent.id)).status).toBe("pending");
    });
  });

  describe("refund", () => {
    it("debits the top-up pool for a refunded top-up, and only once per refund id", async () => {
      // Arrange
      const userId = await seedUserWithBalance({
        subscriptionAmount: 7000,
        topupAmount: TOPUP_AMOUNT_MINOR,
      });
      await seedPaymentIntent({
        userId,
        kind: "topup",
        amount: TOPUP_AMOUNT_MINOR,
        status: "succeeded",
        externalTransactionId: String(PAYMENT_TRANSACTION_ID),
      });
      const refund: RefundInput = {
        userId,
        refundTransactionId: REFUND_TRANSACTION_ID,
        paymentTransactionId: PAYMENT_TRANSACTION_ID,
        amountMajor: TOPUP_AMOUNT_MAJOR,
      };

      // Act
      const firstBody = await deliverRefund(refund);
      const secondBody = await deliverRefund(refund);

      // Assert
      expect(firstBody).toEqual({ code: 0 });
      expect(secondBody).toEqual({ code: 0 });

      const balanceAfter = await readBalance(userId);
      expect(balanceAfter.topupAmount).toBe(0);
      expect(balanceAfter.subscriptionAmount).toBe(7000);

      const transactions = await readTransactions(userId);
      expect(transactions).toHaveLength(1);
      expect(transactions[0]).toMatchObject({
        type: "refund",
        pool: "topup",
        amount: -TOPUP_AMOUNT_MINOR,
        referenceId: String(REFUND_TRANSACTION_ID),
      });
    });

    it("floors the pool at zero when part of the refunded money was already spent", async () => {
      // Arrange
      const userId = await seedUserWithBalance({ topupAmount: 20_000 });
      await seedPaymentIntent({
        userId,
        kind: "topup",
        amount: TOPUP_AMOUNT_MINOR,
        status: "succeeded",
        externalTransactionId: String(PAYMENT_TRANSACTION_ID),
      });

      // Act
      const body = await deliverRefund({
        userId,
        refundTransactionId: REFUND_TRANSACTION_ID,
        paymentTransactionId: PAYMENT_TRANSACTION_ID,
        amountMajor: TOPUP_AMOUNT_MAJOR,
      });

      // Assert
      expect(body).toEqual({ code: 0 });
      expect((await readBalance(userId)).topupAmount).toBe(0);

      const [refundRow] = await readTransactions(userId);
      expect(refundRow.amount).toBe(-20_000);
      expect(refundRow.metadata).toMatchObject({
        refundedAmount: TOPUP_AMOUNT_MINOR,
      });
    });

    it("cancels the subscription when its payment is refunded in full", async () => {
      // Arrange
      const subscriptionPriceMinor = 99_900;
      const externalSubscriptionId = "sc_integration_1";
      const userId = await seedUserWithBalance({
        subscriptionAmount: subscriptionPriceMinor,
        topupAmount: 4000,
      });
      const planId = await seedSubscriptionPlan();
      await seedActiveUserSubscription({
        userId,
        subscriptionId: planId,
        externalSubscriptionId,
      });
      await seedPaymentIntent({
        userId,
        kind: "subscription",
        amount: subscriptionPriceMinor,
        status: "succeeded",
        subscriptionId: planId,
        externalTransactionId: String(PAYMENT_TRANSACTION_ID),
        externalSubscriptionId,
      });
      // The only outbound call: cancelling the recurrent at CloudPayments.
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(Response.json({ Success: true, Message: null }));

      // Act
      const body = await deliverRefund({
        userId,
        refundTransactionId: REFUND_TRANSACTION_ID,
        paymentTransactionId: PAYMENT_TRANSACTION_ID,
        amountMajor: 999,
      });

      // Assert
      expect(body).toEqual({ code: 0 });

      const balanceAfter = await readBalance(userId);
      expect(balanceAfter.subscriptionAmount).toBe(0);
      expect(balanceAfter.topupAmount).toBe(4000);

      const [subscriptionAfter] = await readUserSubscriptions(userId);
      expect(subscriptionAfter.status).toBe("cancelled");
      expect(subscriptionAfter.cancelledAt).not.toBeNull();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [requestUrl, requestInit] = fetchSpy.mock.calls[0];
      expect(String(requestUrl)).toBe(
        "https://api.cloudpayments.ru/subscriptions/cancel"
      );
      expect(JSON.parse(String(requestInit?.body))).toEqual({
        Id: externalSubscriptionId,
      });
    });
  });

  it("rejects a notification with a wrong signature before touching the database", async () => {
    // Arrange
    const userId = await seedUserWithBalance();
    const intent = await seedPaymentIntent({
      userId,
      kind: "topup",
      amount: TOPUP_AMOUNT_MINOR,
    });
    const request = signedWebhookRequest("pay", {
      TransactionId: PAYMENT_TRANSACTION_ID,
      Amount: TOPUP_AMOUNT_MAJOR,
      Currency: "RUB",
      AccountId: userId,
      Data: JSON.stringify({ kind: "topup", sessionId: intent.sessionId }),
    });
    request.headers.set("Content-HMAC", "bm90LXRoZS1yaWdodC1zaWduYXR1cmU=");

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: 13 });
    expect((await readBalance(userId)).topupAmount).toBe(0);
  });
});
