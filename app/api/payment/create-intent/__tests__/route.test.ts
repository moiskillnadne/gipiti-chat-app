import type { Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db/connection";
import type { Subscription, User } from "@/server/db/schema";
import { auth } from "@/server/modules/auth/next-auth";
import {
  getSubscriptionByCode,
  priceForCurrency,
} from "@/server/modules/billing/subscriptions";
import { getUserById } from "@/server/modules/users/queries/get-by-id";

import { POST } from "../route";

const { insertValues } = vi.hoisted(() => ({ insertValues: vi.fn() }));

vi.mock("@/server/modules/auth/next-auth", () => ({ auth: vi.fn() }));
vi.mock("@/server/db/connection", () => ({
  db: { insert: vi.fn(() => ({ values: insertValues })) },
}));
vi.mock("@/server/modules/users/queries/get-by-id", () => ({
  getUserById: vi.fn(),
}));
vi.mock("@/server/modules/billing/subscriptions", () => ({
  getSubscriptionByCode: vi.fn(),
  priceForCurrency: vi.fn(),
}));

// `auth` is overloaded (route wrapper and session getter); tests use the getter.
const mockedAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);

const TESTER_PLAN_CODE = "tester_paid";
const PUBLIC_PLAN_CODE = "basic_monthly";

const subscriptionRow = (code: string, isActive = true): Subscription =>
  ({
    id: `sub-${code}`,
    code,
    isActive,
    billingPeriod: "monthly",
    billingPeriodCount: 1,
  }) as Subscription;

const createRequest = (body: string): Request =>
  new Request("http://localhost/api/payment/create-intent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });

const arrangeUser = (isTester: boolean): void => {
  mockedAuth.mockResolvedValue({
    user: { id: "user-1" },
    expires: "",
  } as Session);
  vi.mocked(getUserById).mockResolvedValue({
    id: "user-1",
    isTester,
  } as User);
};

const arrangePlan = (code: string, isActive = true): void => {
  vi.mocked(getSubscriptionByCode).mockResolvedValue(
    subscriptionRow(code, isActive)
  );
  vi.mocked(priceForCurrency).mockResolvedValue(500);
};

describe("POST /api/payment/create-intent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses a tester-only plan to a non-tester with 403 and stores no intent", async () => {
    // Arrange
    arrangeUser(false);
    arrangePlan(TESTER_PLAN_CODE);

    // Act
    const response = await POST(
      createRequest(JSON.stringify({ planName: TESTER_PLAN_CODE }))
    );

    // Assert
    expect(response.status).toBe(403);
    expect(db.insert).not.toHaveBeenCalled();
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("creates an intent for a tester buying the tester-only plan", async () => {
    arrangeUser(true);
    arrangePlan(TESTER_PLAN_CODE);

    const response = await POST(
      createRequest(JSON.stringify({ planName: TESTER_PLAN_CODE }))
    );

    expect(response.status).toBe(200);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        kind: "subscription",
        subscriptionId: `sub-${TESTER_PLAN_CODE}`,
        amount: 500,
      })
    );
  });

  it("still creates an intent for a public plan", async () => {
    arrangeUser(false);
    arrangePlan(PUBLIC_PLAN_CODE);

    const response = await POST(
      createRequest(JSON.stringify({ planName: PUBLIC_PLAN_CODE }))
    );

    expect(response.status).toBe(200);
    expect(insertValues).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["a body that is not JSON", "not json"],
    ["a body without planName", JSON.stringify({})],
    ["a non-string planName", JSON.stringify({ planName: 42 })],
    ["an empty planName", JSON.stringify({ planName: "" })],
  ])("answers 400 for %s", async (_label, body) => {
    arrangeUser(false);

    const response = await POST(createRequest(body));

    expect(response.status).toBe(400);
    expect(getSubscriptionByCode).not.toHaveBeenCalled();
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("answers 400 for an unknown plan", async () => {
    arrangeUser(false);
    vi.mocked(getSubscriptionByCode).mockResolvedValue(null);

    const response = await POST(
      createRequest(JSON.stringify({ planName: "unknown_plan" }))
    );

    expect(response.status).toBe(400);
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("answers 400 for an inactive plan", async () => {
    arrangeUser(false);
    arrangePlan(PUBLIC_PLAN_CODE, false);

    const response = await POST(
      createRequest(JSON.stringify({ planName: PUBLIC_PLAN_CODE }))
    );

    expect(response.status).toBe(400);
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("answers 401 without a session", async () => {
    mockedAuth.mockResolvedValue(null);

    const response = await POST(
      createRequest(JSON.stringify({ planName: PUBLIC_PLAN_CODE }))
    );

    expect(response.status).toBe(401);
  });
});
