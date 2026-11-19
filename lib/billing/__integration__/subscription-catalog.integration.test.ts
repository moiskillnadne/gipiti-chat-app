import { randomUUID } from "node:crypto";

import { inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { listActiveSubscriptionsWithPrices } from "@/lib/billing/subscriptions";
import { db } from "@/lib/db/connection";
import { currency, subscription, subscriptionPrice } from "@/lib/db/schema";
import {
  closeDatabaseConnection,
  seedCurrency,
  TEST_CURRENCY_CODE,
} from "@/tests/integration/helpers";

const SECOND_CURRENCY_CODE = "USD";

type SeedPlanInput = {
  code: string;
  isActive?: boolean;
  prices?: { currencyCode: string; price: number; isActive?: boolean }[];
};

describe("listActiveSubscriptionsWithPrices against a real database", () => {
  // The catalog table is shared with other test files and is not truncated
  // between runs, so each test works with codes of its own and looks only at
  // those rows.
  let runId: string;
  let seededPlanIds: string[];

  const codeOf = (name: string): string => `catalog_${runId}_${name}`;

  const seedPlan = async ({
    code,
    isActive = true,
    prices = [],
  }: SeedPlanInput): Promise<void> => {
    const [plan] = await db
      .insert(subscription)
      .values({ code, displayName: `Plan ${code}`, isActive })
      .returning({ id: subscription.id });
    seededPlanIds.push(plan.id);

    if (prices.length > 0) {
      await db.insert(subscriptionPrice).values(
        prices.map((price) => ({
          subscriptionId: plan.id,
          currencyCode: price.currencyCode,
          price: price.price,
          isActive: price.isActive ?? true,
        }))
      );
    }
  };

  const listSeeded = async () => {
    const catalog = await listActiveSubscriptionsWithPrices();
    return catalog.filter(({ subscription: plan }) =>
      plan.code.startsWith(`catalog_${runId}_`)
    );
  };

  beforeEach(async () => {
    runId = randomUUID().slice(0, 8);
    seededPlanIds = [];
    await seedCurrency();
    await db
      .insert(currency)
      .values({
        code: SECOND_CURRENCY_CODE,
        name: "US dollar",
        symbol: "$",
        minorUnits: 2,
      })
      .onConflictDoNothing();
  });

  afterEach(async () => {
    // Prices go with their plan (ON DELETE CASCADE).
    await db
      .delete(subscription)
      .where(inArray(subscription.id, seededPlanIds));
  });

  afterAll(async () => {
    await closeDatabaseConnection();
  });

  it("returns active plans ordered by code, each with its prices ordered by currency", async () => {
    // Arrange
    await seedPlan({
      code: codeOf("b_plan"),
      prices: [{ currencyCode: TEST_CURRENCY_CODE, price: 99_900 }],
    });
    await seedPlan({
      code: codeOf("a_plan"),
      prices: [
        { currencyCode: SECOND_CURRENCY_CODE, price: 999 },
        { currencyCode: TEST_CURRENCY_CODE, price: 49_900 },
      ],
    });

    // Act
    const catalog = await listSeeded();

    // Assert
    expect(
      catalog.map(({ subscription: plan, prices }) => ({
        code: plan.code,
        prices,
      }))
    ).toEqual([
      {
        code: codeOf("a_plan"),
        prices: [
          { currencyCode: TEST_CURRENCY_CODE, price: 49_900 },
          { currencyCode: SECOND_CURRENCY_CODE, price: 999 },
        ],
      },
      {
        code: codeOf("b_plan"),
        prices: [{ currencyCode: TEST_CURRENCY_CODE, price: 99_900 }],
      },
    ]);
  });

  it("leaves out inactive plans, inactive prices and plans without an active price", async () => {
    // Arrange
    await seedPlan({
      code: codeOf("inactive_plan"),
      isActive: false,
      prices: [{ currencyCode: TEST_CURRENCY_CODE, price: 100 }],
    });
    await seedPlan({ code: codeOf("no_price") });
    await seedPlan({
      code: codeOf("only_inactive_price"),
      prices: [
        { currencyCode: TEST_CURRENCY_CODE, price: 100, isActive: false },
      ],
    });
    await seedPlan({
      code: codeOf("mixed_prices"),
      prices: [
        { currencyCode: TEST_CURRENCY_CODE, price: 200 },
        { currencyCode: SECOND_CURRENCY_CODE, price: 300, isActive: false },
      ],
    });

    // Act
    const catalog = await listSeeded();

    // Assert
    expect(catalog).toHaveLength(1);
    expect(catalog[0].subscription.code).toBe(codeOf("mixed_prices"));
    expect(catalog[0].prices).toEqual([
      { currencyCode: TEST_CURRENCY_CODE, price: 200 },
    ]);
  });
});
