import { beforeEach, describe, expect, it, vi } from "vitest";

import { getUserById } from "@/lib/db/query/user/get-by-id";
import type { User } from "@/lib/db/schema";
import { SUBSCRIPTION_SEEDS } from "@/lib/subscription/subscription-tiers";

import {
  canPurchaseSubscription,
  isSubscriptionPurchaseAllowed,
  isTesterOnlySubscriptionCode,
  TESTER_ONLY_SUBSCRIPTION_CODES,
} from "../tester-plans";

vi.mock("@/lib/db/connection", () => ({ db: {} }));
vi.mock("@/lib/db/query/user/get-by-id", () => ({ getUserById: vi.fn() }));

const TESTER_PLAN_CODE = "tester_paid";
const PUBLIC_PLAN_CODE = "basic_monthly";

const mockUser = (isTester: boolean): User =>
  ({ id: "user-1", isTester }) as User;

describe("TESTER_ONLY_SUBSCRIPTION_CODES", () => {
  it("equals the set of seed tiers flagged isTester", () => {
    // Arrange
    const seededTesterCodes = SUBSCRIPTION_SEEDS.filter(
      (seed) => seed.isTester
    ).map((seed) => seed.code);

    // Act
    const constantCodes = [...TESTER_ONLY_SUBSCRIPTION_CODES];

    // Assert
    expect(new Set(constantCodes)).toEqual(new Set(seededTesterCodes));
    expect(constantCodes).toHaveLength(seededTesterCodes.length);
  });
});

describe("isTesterOnlySubscriptionCode", () => {
  it("is true for a tester plan and false for a public or unknown plan", () => {
    expect(isTesterOnlySubscriptionCode(TESTER_PLAN_CODE)).toBe(true);
    expect(isTesterOnlySubscriptionCode(PUBLIC_PLAN_CODE)).toBe(false);
    expect(isTesterOnlySubscriptionCode("unknown_plan")).toBe(false);
  });
});

describe("isSubscriptionPurchaseAllowed", () => {
  it("allows a tester plan only for a tester", () => {
    expect(
      isSubscriptionPurchaseAllowed({ code: TESTER_PLAN_CODE, isTester: true })
    ).toBe(true);
    expect(
      isSubscriptionPurchaseAllowed({ code: TESTER_PLAN_CODE, isTester: false })
    ).toBe(false);
  });

  it("allows a public plan for anyone", () => {
    expect(
      isSubscriptionPurchaseAllowed({ code: PUBLIC_PLAN_CODE, isTester: false })
    ).toBe(true);
    expect(
      isSubscriptionPurchaseAllowed({ code: PUBLIC_PLAN_CODE, isTester: true })
    ).toBe(true);
  });
});

describe("canPurchaseSubscription", () => {
  beforeEach(() => {
    vi.mocked(getUserById).mockReset();
  });

  it("allows a tester (per the database) to buy a tester plan", async () => {
    // Arrange
    vi.mocked(getUserById).mockResolvedValue(mockUser(true));

    // Act
    const isAllowed = await canPurchaseSubscription({
      userId: "user-1",
      code: TESTER_PLAN_CODE,
    });

    // Assert
    expect(isAllowed).toBe(true);
    expect(getUserById).toHaveBeenCalledWith("user-1");
  });

  it("refuses a tester plan to a user who is not a tester in the database", async () => {
    vi.mocked(getUserById).mockResolvedValue(mockUser(false));

    const isAllowed = await canPurchaseSubscription({
      userId: "user-1",
      code: TESTER_PLAN_CODE,
    });

    expect(isAllowed).toBe(false);
  });

  it("refuses a tester plan when the user row is missing", async () => {
    vi.mocked(getUserById).mockResolvedValue(null);

    const isAllowed = await canPurchaseSubscription({
      userId: "user-1",
      code: TESTER_PLAN_CODE,
    });

    expect(isAllowed).toBe(false);
  });

  it("allows anyone to buy a public plan without reading the user", async () => {
    const isAllowed = await canPurchaseSubscription({
      userId: "user-1",
      code: PUBLIC_PLAN_CODE,
    });

    expect(isAllowed).toBe(true);
    expect(getUserById).not.toHaveBeenCalled();
  });
});
