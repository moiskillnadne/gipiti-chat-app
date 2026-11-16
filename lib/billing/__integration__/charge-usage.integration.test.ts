import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { chargeUsage } from "@/lib/billing/balance";
import {
  closeDatabaseConnection,
  readBalance,
  readTransactions,
  resetMoneyTables,
  seedCurrency,
  seedFxRate,
  seedUserWithBalance,
} from "@/tests/integration/helpers";

/**
 * With 100 RUB per USD and the x2 usage markup, 1 USD of provider cost is
 * charged as 200 RUB = 20 000 minor units.
 */
const RUB_PER_USD = 100;
const MINOR_UNITS_PER_USD_COST = 20_000;

/**
 * Stays below the connection pool size (10): `chargeUsage` holds one
 * connection for its transaction and takes a second one for the FX lookup.
 */
const CONCURRENT_CHARGES = 5;

describe("chargeUsage against a real database", () => {
  beforeEach(async () => {
    await resetMoneyTables();
    await seedCurrency();
    await seedFxRate(RUB_PER_USD);
  });

  afterAll(async () => {
    await closeDatabaseConnection();
  });

  it("drains the subscription pool before the top-up pool", async () => {
    // Arrange
    const userId = await seedUserWithBalance({
      subscriptionAmount: 5000,
      topupAmount: 30_000,
    });

    // Act: 1 USD costs 20 000 minor units, more than the subscription pool.
    const result = await chargeUsage({ userId, usdCost: 1 });

    // Assert
    const balanceAfter = await readBalance(userId);
    expect(balanceAfter.subscriptionAmount).toBe(0);
    expect(balanceAfter.topupAmount).toBe(15_000);
    expect(result).toMatchObject({
      subscriptionBalanceAfter: 0,
      topupBalanceAfter: 15_000,
    });

    const transactions = await readTransactions(userId);
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({
      type: "usage_debit",
      amount: -MINOR_UNITS_PER_USD_COST,
      subscriptionBalanceAfter: 0,
      topupBalanceAfter: 15_000,
      currencyCode: "RUB",
    });
  });

  it("floors the balance at zero and records the uncharged remainder", async () => {
    // Arrange
    const userId = await seedUserWithBalance({
      subscriptionAmount: 3000,
      topupAmount: 2000,
    });

    // Act
    await chargeUsage({ userId, usdCost: 1 });

    // Assert
    const balanceAfter = await readBalance(userId);
    expect(balanceAfter.subscriptionAmount).toBe(0);
    expect(balanceAfter.topupAmount).toBe(0);

    const [debit] = await readTransactions(userId);
    expect(debit.amount).toBe(-5000);
    expect(debit.metadata).toMatchObject({
      requestedAmount: MINOR_UNITS_PER_USD_COST,
      shortfallAmount: MINOR_UNITS_PER_USD_COST - 5000,
    });
  });

  it("applies every one of several concurrent charges exactly once", async () => {
    // Arrange
    const startingTopup = 1_000_000;
    const userId = await seedUserWithBalance({ topupAmount: startingTopup });
    const usdCostPerCharge = 0.5;
    const minorPerCharge = MINOR_UNITS_PER_USD_COST * usdCostPerCharge;

    // Act: without the row lock, concurrent read-modify-write would lose updates.
    await Promise.all(
      Array.from({ length: CONCURRENT_CHARGES }, () =>
        chargeUsage({ userId, usdCost: usdCostPerCharge })
      )
    );

    // Assert
    const balanceAfter = await readBalance(userId);
    expect(balanceAfter.topupAmount).toBe(
      startingTopup - CONCURRENT_CHARGES * minorPerCharge
    );

    const transactions = await readTransactions(userId);
    expect(transactions).toHaveLength(CONCURRENT_CHARGES);
    expect(transactions.every(({ amount }) => amount === -minorPerCharge)).toBe(
      true
    );
    // Each charge saw the balance the previous one left: all different.
    const balancesAfter = new Set(
      transactions.map(({ topupBalanceAfter }) => topupBalanceAfter)
    );
    expect(balancesAfter.size).toBe(CONCURRENT_CHARGES);
  });

  it("charges nothing when there is no FX rate for the balance currency", async () => {
    // Arrange
    await resetMoneyTables();
    const userId = await seedUserWithBalance({ topupAmount: 10_000 });

    // Act
    const result = await chargeUsage({ userId, usdCost: 1 });

    // Assert
    expect(result).toBeNull();
    expect((await readBalance(userId)).topupAmount).toBe(10_000);
    expect(await readTransactions(userId)).toHaveLength(0);
  });

  it("charges nothing for a user without a balance row", async () => {
    // Act
    const result = await chargeUsage({
      userId: "00000000-0000-4000-8000-000000000000",
      usdCost: 1,
    });

    // Assert
    expect(result).toBeNull();
  });
});
