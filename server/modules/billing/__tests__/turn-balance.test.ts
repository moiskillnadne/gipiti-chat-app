import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  MIN_IMAGE_TURN_BALANCE_MINOR,
  MIN_TEXT_TURN_BALANCE_MINOR,
  MIN_VIDEO_TURN_BALANCE_MINOR,
  USAGE_MARKUP,
} from "@/lib/billing/constants";

const { getBalanceMock, getCurrencyPricingMock } = vi.hoisted(() => ({
  getBalanceMock: vi.fn(),
  getCurrencyPricingMock: vi.fn(),
}));

vi.mock("@/server/db/connection", () => ({ db: {} }));
vi.mock("@/server/modules/billing/balance", () => ({
  getBalance: getBalanceMock,
}));
vi.mock("@/server/modules/billing/fx", () => ({
  getCurrencyPricing: getCurrencyPricingMock,
}));

import { checkTurnBalance, requiredTurnBalanceMinor } from "../turn-balance";

const RUB_PRICING = { minorUnits: 2, fxRate: 80 };

describe("requiredTurnBalanceMinor", () => {
  it("requires the constant floor for a text turn", () => {
    const required = requiredTurnBalanceMinor({
      mode: "text",
      estimatedCostUsd: 5,
      pricing: RUB_PRICING,
    });

    expect(required).toBe(MIN_TEXT_TURN_BALANCE_MINOR);
  });

  it("converts a media estimate with the FX rate and the usage markup", () => {
    // Arrange: $0.5 × 80 RUB/USD × markup, in kopecks.
    const expected = Math.ceil(0.5 * 80 * USAGE_MARKUP * 100);

    // Act
    const required = requiredTurnBalanceMinor({
      mode: "video",
      estimatedCostUsd: 0.5,
      pricing: RUB_PRICING,
    });

    // Assert
    expect(required).toBe(expected);
  });

  it("falls back to the per-mode floor when the model has no estimate", () => {
    expect(
      requiredTurnBalanceMinor({ mode: "image", pricing: RUB_PRICING })
    ).toBe(MIN_IMAGE_TURN_BALANCE_MINOR);
    expect(
      requiredTurnBalanceMinor({ mode: "video", pricing: RUB_PRICING })
    ).toBe(MIN_VIDEO_TURN_BALANCE_MINOR);
  });

  it("falls back to the per-mode floor when no FX rate is cached", () => {
    const required = requiredTurnBalanceMinor({
      mode: "image",
      estimatedCostUsd: 0.04,
      pricing: { minorUnits: 2, fxRate: null },
    });

    expect(required).toBe(MIN_IMAGE_TURN_BALANCE_MINOR);
  });
});

describe("checkTurnBalance", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("is insufficient when the user has no balance row", async () => {
    getBalanceMock.mockResolvedValue(null);

    const check = await checkTurnBalance({ userId: "user-1", mode: "text" });

    expect(check).toEqual({
      isSufficient: false,
      requiredMinor: MIN_TEXT_TURN_BALANCE_MINOR,
      availableMinor: 0,
    });
  });

  it("is sufficient at exactly the required minimum", async () => {
    getBalanceMock.mockResolvedValue({
      currencyCode: "RUB",
      subscriptionAmount: MIN_TEXT_TURN_BALANCE_MINOR - 40,
      topupAmount: 40,
      total: MIN_TEXT_TURN_BALANCE_MINOR,
    });

    const check = await checkTurnBalance({ userId: "user-1", mode: "text" });

    expect(check.isSufficient).toBe(true);
    expect(getCurrencyPricingMock).not.toHaveBeenCalled();
  });

  it("prices a media estimate in the balance currency", async () => {
    getBalanceMock.mockResolvedValue({
      currencyCode: "RUB",
      subscriptionAmount: 0,
      topupAmount: 1000,
      total: 1000,
    });
    getCurrencyPricingMock.mockResolvedValue(RUB_PRICING);

    const check = await checkTurnBalance({
      userId: "user-1",
      mode: "image",
      estimatedCostUsd: 0.1,
    });

    expect(getCurrencyPricingMock).toHaveBeenCalledWith("RUB");
    expect(check).toEqual({
      isSufficient: false,
      requiredMinor: Math.ceil(0.1 * 80 * USAGE_MARKUP * 100),
      availableMinor: 1000,
    });
  });
});
