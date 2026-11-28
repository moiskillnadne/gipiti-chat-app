import { randomUUID } from "node:crypto";

import { eq, like } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { db } from "@/server/db/connection";
import {
  subscription,
  subscriptionPrice,
  userSubscription,
} from "@/server/db/schema";
import { getSubscriptionSummary } from "@/server/modules/subscription/get-subscription-summary";
import {
  closeDatabaseConnection,
  resetMoneyTables,
  seedCurrency,
  seedUserWithBalance,
} from "@/tests/integration/helpers";

const NOW = new Date("2026-03-15T12:00:00.000Z");
const PLAN_PRICE_MINOR = 99_000;
const DAY_MS = 86_400_000;
const PROVIDER_SECRETS_PATTERN = /sc_provider_secret|token_secret/;

const seededPlanIds: string[] = [];

const seedPlan = async (): Promise<string> => {
  const [plan] = await db
    .insert(subscription)
    .values({
      code: `summary_${randomUUID()}`,
      displayName: "Basic",
      billingPeriod: "monthly",
    })
    .returning({ id: subscription.id });
  await db.insert(subscriptionPrice).values({
    subscriptionId: plan.id,
    currencyCode: "RUB",
    price: PLAN_PRICE_MINOR,
  });

  seededPlanIds.push(plan.id);

  return plan.id;
};

const seedUserSubscription = async ({
  userId,
  subscriptionId,
  status,
  cancelAtPeriodEnd = false,
  periodEndInDays,
}: {
  userId: string;
  subscriptionId: string;
  status: "active" | "past_due" | "cancelled" | "expired";
  cancelAtPeriodEnd?: boolean;
  periodEndInDays: number;
}): Promise<void> => {
  const periodEnd = new Date(NOW.getTime() + periodEndInDays * DAY_MS);
  await db.insert(userSubscription).values({
    userId,
    subscriptionId,
    currencyCode: "RUB",
    status,
    cancelAtPeriodEnd,
    cancelledAt: cancelAtPeriodEnd ? NOW : null,
    currentPeriodStart: new Date(periodEnd.getTime() - 30 * DAY_MS),
    currentPeriodEnd: periodEnd,
    nextBillingDate: periodEnd,
    externalSubscriptionId: "sc_provider_secret",
    cardToken: "token_secret",
    cardMask: "Visa ****4242",
  });
};

describe("the subscription summary against a real database", () => {
  // A killed run leaves its plans behind, and a RUB price stops other files
  // from removing the currency. Prices go with the plan (cascade).
  beforeAll(async () => {
    await db.delete(subscription).where(like(subscription.code, "summary_%"));
  });

  beforeEach(async () => {
    await resetMoneyTables();
    await seedCurrency();
  });

  // Catalog rows survive `resetMoneyTables`; leaving a RUB price behind would
  // stop other tests from removing the currency.
  afterEach(async () => {
    await resetMoneyTables();
    for (const planId of seededPlanIds.splice(0)) {
      await db.delete(subscription).where(eq(subscription.id, planId));
    }
  });

  afterAll(async () => {
    await closeDatabaseConnection();
  });

  it("is null for a user who never subscribed, with or without a balance row", async () => {
    // Arrange
    const userId = await seedUserWithBalance();

    // Act
    const summary = await getSubscriptionSummary({ userId, now: NOW });

    // Assert
    expect(summary).toBeNull();
  });

  it("describes an active subscription with the plan price, next payment and card mask", async () => {
    // Arrange
    const userId = await seedUserWithBalance();
    await seedUserSubscription({
      userId,
      subscriptionId: await seedPlan(),
      status: "active",
      periodEndInDays: 10,
    });

    // Act
    const summary = await getSubscriptionSummary({ userId, now: NOW });

    // Assert
    expect(summary).toMatchObject({
      displayName: "Basic",
      billingPeriod: "monthly",
      status: "active",
      state: "active",
      cancelAtPeriodEnd: false,
      cancelledAt: null,
      currencyCode: "RUB",
      priceMinor: PLAN_PRICE_MINOR,
      nextPayment: { amountMinor: PLAN_PRICE_MINOR },
      cardMask: "Visa ****4242",
    });
    expect(JSON.stringify(summary)).not.toMatch(PROVIDER_SECRETS_PATTERN);
  });

  it("marks a subscription cancelled at the period end as cancelled, with no next payment, until it ends", async () => {
    // Arrange
    const userId = await seedUserWithBalance();
    await seedUserSubscription({
      userId,
      subscriptionId: await seedPlan(),
      status: "active",
      cancelAtPeriodEnd: true,
      periodEndInDays: 5,
    });

    // Act
    const duringAccess = await getSubscriptionSummary({ userId, now: NOW });
    const afterAccess = await getSubscriptionSummary({
      userId,
      now: new Date(NOW.getTime() + 6 * DAY_MS),
    });

    // Assert
    expect(duringAccess).toMatchObject({
      state: "cancelled",
      cancelAtPeriodEnd: true,
      nextPayment: null,
    });
    expect(duringAccess?.cancelledAt).toEqual(NOW);
    expect(afterAccess?.state).toBe("none");
  });

  it("returns an expired subscription as state none and a past-due one with a retry and no amount", async () => {
    // Arrange
    const expiredUserId = await seedUserWithBalance();
    const planId = await seedPlan();
    await seedUserSubscription({
      userId: expiredUserId,
      subscriptionId: planId,
      status: "expired",
      periodEndInDays: -3,
    });
    const pastDueUserId = await seedUserWithBalance();
    await seedUserSubscription({
      userId: pastDueUserId,
      subscriptionId: planId,
      status: "past_due",
      periodEndInDays: 2,
    });

    // Act
    const expired = await getSubscriptionSummary({
      userId: expiredUserId,
      now: NOW,
    });
    const pastDue = await getSubscriptionSummary({
      userId: pastDueUserId,
      now: NOW,
    });

    // Assert
    expect(expired).toMatchObject({
      status: "expired",
      state: "none",
      nextPayment: null,
    });
    expect(pastDue).toMatchObject({
      status: "past_due",
      state: "past_due",
      nextPayment: { amountMinor: null },
    });
  });
});
