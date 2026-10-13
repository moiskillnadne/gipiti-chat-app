import { describe, expect, it, vi } from "vitest";

import { planRefundDebit, poolForPayment } from "../refund";

// planRefundDebit is pure; stub the DB so importing the module never connects.
vi.mock("@/lib/db/connection", () => ({ db: {} }));

describe("planRefundDebit", () => {
  it("debits the whole refund and marks a full refund when the pool covers it", () => {
    // Arrange
    const input = {
      refundAmount: 50_000,
      poolBalance: 80_000,
      paymentAmount: 50_000,
      previouslyRefundedAmount: 0,
    };

    // Act
    const plan = planRefundDebit(input);

    // Assert
    expect(plan).toEqual({ debitAmount: 50_000, isFullyRefunded: true });
  });

  it("treats a refund smaller than the payment as partial", () => {
    const plan = planRefundDebit({
      refundAmount: 20_000,
      poolBalance: 50_000,
      paymentAmount: 50_000,
      previouslyRefundedAmount: 0,
    });

    expect(plan).toEqual({ debitAmount: 20_000, isFullyRefunded: false });
  });

  it("floors the debit at the pool balance when the user already spent part", () => {
    const plan = planRefundDebit({
      refundAmount: 50_000,
      poolBalance: 12_345,
      paymentAmount: 50_000,
      previouslyRefundedAmount: 0,
    });

    expect(plan).toEqual({ debitAmount: 12_345, isFullyRefunded: true });
  });

  it("debits nothing when the pool is already empty", () => {
    const plan = planRefundDebit({
      refundAmount: 50_000,
      poolBalance: 0,
      paymentAmount: 50_000,
      previouslyRefundedAmount: 0,
    });

    expect(plan.debitAmount).toBe(0);
  });

  it("marks a full refund once several partial refunds add up to the payment", () => {
    const plan = planRefundDebit({
      refundAmount: 30_000,
      poolBalance: 30_000,
      paymentAmount: 50_000,
      previouslyRefundedAmount: 20_000,
    });

    expect(plan).toEqual({ debitAmount: 30_000, isFullyRefunded: true });
  });

  it("caps an over-refund at the pool balance", () => {
    const plan = planRefundDebit({
      refundAmount: 70_000,
      poolBalance: 50_000,
      paymentAmount: 50_000,
      previouslyRefundedAmount: 0,
    });

    expect(plan).toEqual({ debitAmount: 50_000, isFullyRefunded: true });
  });
});

describe("poolForPayment", () => {
  it("maps top-ups to the top-up pool and subscriptions to the subscription pool", () => {
    expect(poolForPayment("topup")).toBe("topup");
    expect(poolForPayment("subscription")).toBe("subscription");
  });
});
