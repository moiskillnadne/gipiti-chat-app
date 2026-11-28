import { beforeEach, describe, expect, it, vi } from "vitest";

type DueSubscriptionRow = {
  sub: {
    id: string;
    userId: string;
    subscriptionId: string;
    currencyCode: string;
    currentPeriodEnd: Date;
    externalSubscriptionId: string | null;
  };
  billingPeriod: "monthly";
  billingPeriodCount: number;
  isTester: boolean;
};

type SubscriptionUpdate = Record<string, unknown>;

const {
  dbState,
  resetSubscriptionPoolMock,
  priceForCurrencyMock,
  assignFreePlanMock,
} = vi.hoisted(() => ({
  dbState: {
    dueRows: [] as DueSubscriptionRow[],
    updates: [] as SubscriptionUpdate[],
  },
  resetSubscriptionPoolMock: vi.fn(),
  priceForCurrencyMock: vi.fn(),
  assignFreePlanMock: vi.fn(),
}));

// Minimal Drizzle stand-in: the select chain resolves to the due rows, the
// update chain records the values passed to `.set()`.
vi.mock("@/server/db/connection", () => {
  const selectChain = {
    from: () => selectChain,
    innerJoin: () => selectChain,
    where: () => Promise.resolve(dbState.dueRows),
  };

  return {
    db: {
      select: () => selectChain,
      update: () => ({
        set: (values: SubscriptionUpdate) => {
          dbState.updates.push(values);
          return { where: () => Promise.resolve() };
        },
      }),
    },
  };
});
vi.mock("@/server/modules/billing/balance", () => ({
  resetSubscriptionPool: resetSubscriptionPoolMock,
}));
vi.mock("@/server/modules/billing/subscriptions", () => ({
  priceForCurrency: priceForCurrencyMock,
}));
vi.mock("@/server/modules/subscription/subscription-init", () => ({
  assignFreePlan: assignFreePlanMock,
}));

import { GET } from "../route";

const CRON_SECRET = "test-cron-secret";
const PLAN_PRICE_MINOR = 99_900;

const buildRow = ({
  userId,
  isTester,
  externalSubscriptionId = null,
}: {
  userId: string;
  isTester: boolean;
  externalSubscriptionId?: string | null;
}): DueSubscriptionRow => ({
  sub: {
    id: `us_${userId}`,
    userId,
    subscriptionId: "plan_basic",
    currencyCode: "RUB",
    currentPeriodEnd: new Date("2026-11-01T00:00:00Z"),
    externalSubscriptionId,
  },
  billingPeriod: "monthly",
  billingPeriodCount: 1,
  isTester,
});

const callCron = async (): Promise<Response> =>
  GET(
    new Request("https://example.test/api/cron/reset-quotas", {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    })
  );

describe("GET /api/cron/reset-quotas", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", CRON_SECRET);
    vi.spyOn(console, "log").mockReturnValue(undefined);
    vi.spyOn(console, "error").mockReturnValue(undefined);
    dbState.dueRows = [];
    dbState.updates = [];
    resetSubscriptionPoolMock.mockReset();
    priceForCurrencyMock.mockReset().mockResolvedValue(PLAN_PRICE_MINOR);
    assignFreePlanMock.mockReset().mockResolvedValue(undefined);
  });

  it("rejects `Bearer undefined` when CRON_SECRET is not configured", async () => {
    // Arrange
    vi.stubEnv("CRON_SECRET", undefined);
    dbState.dueRows = [buildRow({ userId: "user_regular", isTester: false })];

    // Act
    const response = await GET(
      new Request("https://example.test/api/cron/reset-quotas", {
        headers: { authorization: "Bearer undefined" },
      })
    );

    // Assert
    expect(response.status).toBe(401);
    expect(dbState.updates).toEqual([]);
    expect(assignFreePlanMock).not.toHaveBeenCalled();
  });

  it("expires a non-tester's subscription and moves the user to the free state", async () => {
    // Arrange
    dbState.dueRows = [buildRow({ userId: "user_regular", isTester: false })];

    // Act
    const response = await callCron();
    const body = await response.json();

    // Assert
    expect(dbState.updates).toEqual([
      expect.objectContaining({ status: "expired" }),
    ]);
    expect(dbState.updates[0]).not.toHaveProperty("currentPeriodEnd");
    expect(assignFreePlanMock).toHaveBeenCalledWith("user_regular");
    expect(resetSubscriptionPoolMock).not.toHaveBeenCalled();
    expect(body).toMatchObject({ renewed: 0, expired: 1, balancesReset: 0 });
  });

  it("renews a tester's subscription and resets the pool to the plan price", async () => {
    // Arrange
    dbState.dueRows = [buildRow({ userId: "user_tester", isTester: true })];

    // Act
    const response = await callCron();
    const body = await response.json();

    // Assert
    expect(dbState.updates).toEqual([
      expect.objectContaining({
        currentPeriodStart: new Date("2026-11-01T00:00:00Z"),
        currentPeriodEnd: expect.any(Date),
      }),
    ]);
    expect(dbState.updates[0]).not.toHaveProperty("status");
    expect(resetSubscriptionPoolMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_tester",
        amount: PLAN_PRICE_MINOR,
        type: "subscription_renewal",
      })
    );
    expect(assignFreePlanMock).not.toHaveBeenCalled();
    expect(body).toMatchObject({ renewed: 1, expired: 0, balancesReset: 1 });
  });

  it("does not touch a subscription renewed by CloudPayments", async () => {
    // Arrange
    dbState.dueRows = [
      buildRow({
        userId: "user_recurring",
        isTester: false,
        externalSubscriptionId: "sc_123",
      }),
    ];

    // Act
    const response = await callCron();
    const body = await response.json();

    // Assert
    expect(dbState.updates).toEqual([]);
    expect(assignFreePlanMock).not.toHaveBeenCalled();
    expect(resetSubscriptionPoolMock).not.toHaveBeenCalled();
    expect(body).toMatchObject({ renewed: 0, expired: 0 });
  });

  it("keeps processing other rows when the free-plan downgrade fails", async () => {
    // Arrange
    dbState.dueRows = [
      buildRow({ userId: "user_first", isTester: false }),
      buildRow({ userId: "user_second", isTester: false }),
    ];
    assignFreePlanMock
      .mockRejectedValueOnce(new Error("db unavailable"))
      .mockResolvedValueOnce(undefined);

    // Act
    const response = await callCron();
    const body = await response.json();

    // Assert
    expect(assignFreePlanMock).toHaveBeenCalledTimes(2);
    expect(assignFreePlanMock).toHaveBeenLastCalledWith("user_second");
    expect(body).toMatchObject({ expired: 2 });
  });
});
