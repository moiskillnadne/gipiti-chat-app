import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getBalance: vi.fn(),
  getMinorUnits: vi.fn(),
  getSpendProgress: vi.fn(),
  getActiveStatusSubscription: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/modules/auth/next-auth", () => ({ auth: mocks.auth }));
vi.mock("@/server/modules/billing/balance", () => ({
  getBalance: mocks.getBalance,
}));
vi.mock("@/server/modules/billing/currencies", () => ({
  getMinorUnits: mocks.getMinorUnits,
}));
vi.mock("@/server/modules/billing/spend", () => ({
  getSpendProgress: mocks.getSpendProgress,
}));
vi.mock("@/server/modules/billing/subscriptions", () => ({
  getActiveStatusSubscription: mocks.getActiveStatusSubscription,
}));

import { GET } from "../route";

const USER_ID = "user-1";

const balanceSummary = {
  currencyCode: "RUB",
  subscriptionAmount: 20_000,
  topupAmount: 30_000,
  total: 50_000,
};

const subscriptionRow = {
  id: "sub-1",
  cardToken: "tk_secret",
  externalSubscriptionId: "sc_secret",
};

const leakedSecrets = (body: unknown): string[] => {
  const serialized = JSON.stringify(body);
  return ["tk_secret", "sc_secret"].filter((secret) =>
    serialized.includes(secret)
  );
};

const spendProgress = { spentPercent: 40, epochKey: "epoch-1" };

describe("GET /api/usage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: USER_ID } });
    mocks.getBalance.mockResolvedValue(balanceSummary);
    mocks.getMinorUnits.mockResolvedValue(2);
    mocks.getSpendProgress.mockResolvedValue(spendProgress);
    mocks.getActiveStatusSubscription.mockResolvedValue(subscriptionRow);
  });

  it("returns 401 to a signed-out visitor and reads nothing", async () => {
    // Arrange
    mocks.auth.mockResolvedValue(null);

    // Act
    const response = await GET();

    // Assert
    expect(response.status).toBe(401);
    expect(mocks.getBalance).not.toHaveBeenCalled();
  });

  it("answers with exactly the balance and spend keys when a balance row exists", async () => {
    // Arrange
    // (defaults from beforeEach)

    // Act
    const response = await GET();
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(["balance", "spend"]);
    expect(Object.keys(body.balance).sort()).toEqual([
      "currencyCode",
      "formatted",
      "subscriptionAmount",
      "topupAmount",
      "total",
    ]);
    expect(body.balance).toMatchObject(balanceSummary);
    expect(typeof body.balance.formatted).toBe("string");
    expect(body.spend).toEqual(spendProgress);
    expect(leakedSecrets(body)).toEqual([]);
    expect(mocks.getSpendProgress).toHaveBeenCalledWith(
      USER_ID,
      balanceSummary
    );
  });

  it("answers with exactly null balance and null spend when there is no balance row", async () => {
    // Arrange
    mocks.getBalance.mockResolvedValue(null);

    // Act
    const response = await GET();
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body).toEqual({ balance: null, spend: null });
    expect(leakedSecrets(body)).toEqual([]);
    expect(Object.keys(body).sort()).toEqual(["balance", "spend"]);
  });

  it("never queries the subscription, so no provider field can reach the browser", async () => {
    // Arrange
    // (subscription row with secrets set in beforeEach)

    // Act
    const withBalance = await GET();
    mocks.getBalance.mockResolvedValue(null);
    const withoutBalance = await GET();

    // Assert
    expect(mocks.getActiveStatusSubscription).not.toHaveBeenCalled();
    expect(leakedSecrets(await withBalance.json())).toEqual([]);
    expect(leakedSecrets(await withoutBalance.json())).toEqual([]);
  });
});
