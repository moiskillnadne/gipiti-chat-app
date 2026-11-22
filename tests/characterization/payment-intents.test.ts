import type { Session } from "next-auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/server/modules/auth/next-auth";
import { ensureBalance, getBalance } from "@/lib/billing/balance";
import {
  getSubscriptionByCode,
  priceForCurrency,
} from "@/lib/billing/subscriptions";
import { getUserById } from "@/server/modules/users/queries/get-by-id";
import type { PaymentIntent, Subscription, User } from "@/server/db/schema";
import { isTopupEnabled } from "@/server/flags";
import { checkPaymentStatusRateLimit } from "@/server/http/rate-limit";
import {
  getLatestSubscription,
  type LatestSubscription,
} from "@/lib/subscription/get-latest-subscription";

import {
  paymentCreateIntentPost,
  paymentStatusGet,
  topupCreateIntentPost,
} from "./targets/payment-intents";

// Every `db.select()...limit()` call resolves the next queued row set, in
// the order the route issues its queries.
const { selectResults, insertValues, dbMock } = vi.hoisted(() => {
  const queuedSelectResults: unknown[][] = [];
  const insertValuesMock = vi.fn().mockResolvedValue(undefined);
  const updateSetMock = vi.fn(() => ({
    where: vi.fn().mockResolvedValue(undefined),
  }));

  const selectChain = {
    from: () => selectChain,
    innerJoin: () => selectChain,
    where: () => selectChain,
    limit: async () => queuedSelectResults.shift() ?? [],
  };

  return {
    selectResults: queuedSelectResults,
    insertValues: insertValuesMock,
    dbMock: {
      select: vi.fn(() => selectChain),
      insert: vi.fn(() => ({ values: insertValuesMock })),
      update: vi.fn(() => ({ set: updateSetMock })),
    },
  };
});

vi.mock("@/server/modules/auth/next-auth", () => ({ auth: vi.fn() }));
vi.mock("@/server/flags", () => ({ isTopupEnabled: vi.fn() }));
vi.mock("@/server/http/rate-limit", () => ({
  checkPaymentStatusRateLimit: vi.fn(),
}));
vi.mock("@/server/db/connection", () => ({ db: dbMock }));
vi.mock("@/server/modules/users/queries/get-by-id", () => ({
  getUserById: vi.fn(),
}));
vi.mock("@/lib/billing/balance", () => ({
  ensureBalance: vi.fn(),
  getBalance: vi.fn(),
}));
vi.mock("@/lib/billing/subscriptions", () => ({
  getSubscriptionByCode: vi.fn(),
  priceForCurrency: vi.fn(),
}));
vi.mock("@/lib/subscription/get-latest-subscription", () => ({
  getLatestSubscription: vi.fn(),
}));

// `auth` is overloaded (route wrapper and session getter); tests use the getter.
const mockedAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);
// The flag is a callable with SDK metadata attached; the routes only call it.
const mockedIsTopupEnabled = vi.mocked(
  isTopupEnabled as unknown as () => Promise<boolean>
);

const NOW = new Date("2030-01-01T00:00:00.000Z");
const INTENT_TTL_MS = 30 * 60 * 1000;
const EXPECTED_EXPIRES_AT = new Date(NOW.getTime() + INTENT_TTL_MS);

const USER_ID = "user-1";
const CLIENT_IP = "203.0.113.7";
const PLAN_CODE = "basic_monthly";
const PLAN_PRICE_MINOR = 49_900;
const TOPUP_AMOUNT_MAJOR = 1000;
const TOPUP_AMOUNT_MINOR = 100_000;
const STATUS_SESSION_ID = "ps_status_session";
const EXTERNAL_SUBSCRIPTION_ID = "sc_external";

const SUBSCRIPTION_SESSION_ID_PATTERN = /^ps_[0-9a-f]{56}$/;
const TOPUP_SESSION_ID_PATTERN = /^tu_[0-9a-f]{56}$/;

const createPostRequest = (path: string, body: string): Request =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });

const createSubscriptionIntentRequest = (body: string): Request =>
  createPostRequest("/api/payment/create-intent", body);

const createTopupIntentRequest = (body: string): Request =>
  createPostRequest("/api/topup/create-intent", body);

const createStatusRequest = (sessionId: string | null): Request => {
  const url = new URL("http://localhost/api/payment/status");
  if (sessionId !== null) {
    url.searchParams.set("sessionId", sessionId);
  }

  return new Request(url, { headers: { "x-forwarded-for": CLIENT_IP } });
};

const subscriptionRow = (code: string): Subscription =>
  ({
    id: `sub-${code}`,
    code,
    isActive: true,
    billingPeriod: "monthly",
    billingPeriodCount: 1,
  }) as Subscription;

const activeLatestSubscription = (): LatestSubscription =>
  ({
    subscription: {
      id: "user-subscription-1",
      status: "active",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: new Date(NOW.getTime() + INTENT_TTL_MS),
    },
    code: PLAN_CODE,
    displayName: null,
    billingPeriod: "monthly",
  }) as LatestSubscription;

const paymentIntentRow = (
  overrides: Partial<PaymentIntent> = {}
): PaymentIntent => ({
  id: "intent-1",
  sessionId: STATUS_SESSION_ID,
  userId: USER_ID,
  kind: "subscription",
  subscriptionId: `sub-${PLAN_CODE}`,
  currencyCode: "RUB",
  amount: PLAN_PRICE_MINOR,
  status: "pending",
  externalTransactionId: null,
  externalSubscriptionId: null,
  failureReason: null,
  metadata: null,
  expiresAt: new Date(NOW.getTime() + INTENT_TTL_MS),
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

const arrangeSession = (): void => {
  mockedAuth.mockResolvedValue({
    user: { id: USER_ID },
    expires: "",
  } as Session);
};

/** A signed-in subscriber with a RUB balance and the top-up flag on. */
const arrangeTopupEligibleUser = (): void => {
  arrangeSession();
  mockedIsTopupEnabled.mockResolvedValue(true);
  vi.mocked(getUserById).mockResolvedValue({
    id: USER_ID,
    isTester: false,
  } as User);
  vi.mocked(getLatestSubscription).mockResolvedValue(
    activeLatestSubscription()
  );
  vi.mocked(ensureBalance).mockResolvedValue({
    currencyCode: "RUB",
    subscriptionAmount: 0,
    topupAmount: 0,
    total: 0,
  });
};

const arrangeStatusRequester = (): void => {
  arrangeSession();
  vi.mocked(checkPaymentStatusRateLimit).mockResolvedValue({ success: true });
};

beforeEach(() => {
  vi.clearAllMocks();
  selectResults.length = 0;
  // Only the clock is faked, so expiry maths is exact and promises still run.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/payment/create-intent", () => {
  it("answers 401 with a plain-text body without a session", async () => {
    // Arrange
    mockedAuth.mockResolvedValue(null);

    // Act
    const response = await paymentCreateIntentPost(
      createSubscriptionIntentRequest(JSON.stringify({ planName: PLAN_CODE }))
    );

    // Assert
    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Unauthorized");
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("stores a pending subscription intent at the plan price and returns its session", async () => {
    // Arrange
    arrangeSession();
    vi.mocked(getSubscriptionByCode).mockResolvedValue(
      subscriptionRow(PLAN_CODE)
    );
    vi.mocked(priceForCurrency).mockResolvedValue(PLAN_PRICE_MINOR);

    // Act
    const response = await paymentCreateIntentPost(
      createSubscriptionIntentRequest(JSON.stringify({ planName: PLAN_CODE }))
    );
    const body: { sessionId: string } = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body).toEqual({
      sessionId: expect.stringMatching(SUBSCRIPTION_SESSION_ID_PATTERN),
      expiresAt: EXPECTED_EXPIRES_AT.toISOString(),
    });
    expect(insertValues).toHaveBeenCalledTimes(1);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: body.sessionId,
        userId: USER_ID,
        kind: "subscription",
        subscriptionId: `sub-${PLAN_CODE}`,
        currencyCode: "RUB",
        amount: PLAN_PRICE_MINOR,
        status: "pending",
        expiresAt: EXPECTED_EXPIRES_AT,
      })
    );
  });
});

describe("POST /api/topup/create-intent", () => {
  it("answers 401 with a plain-text body without a session", async () => {
    // Arrange
    mockedAuth.mockResolvedValue(null);

    // Act
    const response = await topupCreateIntentPost(
      createTopupIntentRequest(JSON.stringify({ amount: TOPUP_AMOUNT_MAJOR }))
    );

    // Assert
    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Unauthorized");
    expect(mockedIsTopupEnabled).not.toHaveBeenCalled();
  });

  it("answers 403 while the top-up flag is off for the user", async () => {
    // Arrange
    arrangeTopupEligibleUser();
    mockedIsTopupEnabled.mockResolvedValue(false);

    // Act
    const response = await topupCreateIntentPost(
      createTopupIntentRequest(JSON.stringify({ amount: TOPUP_AMOUNT_MAJOR }))
    );

    // Assert
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Top-up is not available" });
    expect(getUserById).not.toHaveBeenCalled();
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it.each([
    ["an amount below the minimum", JSON.stringify({ amount: 499 })],
    ["an amount above the maximum", JSON.stringify({ amount: 50_001 })],
    ["a fractional amount", JSON.stringify({ amount: 500.5 })],
    ["an amount sent as a string", JSON.stringify({ amount: "1000" })],
    ["a body without an amount", JSON.stringify({})],
  ])("answers 400 for %s", async (_label, body) => {
    // Arrange
    arrangeTopupEligibleUser();

    // Act
    const response = await topupCreateIntentPost(
      createTopupIntentRequest(body)
    );

    // Assert
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid top-up amount" });
    expect(getLatestSubscription).not.toHaveBeenCalled();
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("answers 403 for a user who never subscribed", async () => {
    // Arrange
    arrangeTopupEligibleUser();
    vi.mocked(getLatestSubscription).mockResolvedValue(null);

    // Act
    const response = await topupCreateIntentPost(
      createTopupIntentRequest(JSON.stringify({ amount: TOPUP_AMOUNT_MAJOR }))
    );

    // Assert
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Top-up requires a subscription",
    });
    expect(ensureBalance).not.toHaveBeenCalled();
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("answers 400 when the balance is not held in RUB", async () => {
    // Arrange
    arrangeTopupEligibleUser();
    vi.mocked(ensureBalance).mockResolvedValue({
      currencyCode: "KZT",
      subscriptionAmount: 0,
      topupAmount: 0,
      total: 0,
    });

    // Act
    const response = await topupCreateIntentPost(
      createTopupIntentRequest(JSON.stringify({ amount: TOPUP_AMOUNT_MAJOR }))
    );

    // Assert
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Top-up is only available for RUB balances",
    });
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("answers 500 for a body that is not JSON", async () => {
    // Arrange
    arrangeTopupEligibleUser();

    // Act
    const response = await topupCreateIntentPost(
      createTopupIntentRequest("not json")
    );

    // Assert: pinned as-is, a malformed body is a server error today, not 400.
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Failed to create top-up intent",
    });
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("stores a pending top-up intent in minor units and returns its session", async () => {
    // Arrange
    arrangeTopupEligibleUser();

    // Act
    const response = await topupCreateIntentPost(
      createTopupIntentRequest(JSON.stringify({ amount: TOPUP_AMOUNT_MAJOR }))
    );
    const body: { sessionId: string } = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body).toEqual({
      sessionId: expect.stringMatching(TOPUP_SESSION_ID_PATTERN),
      expiresAt: EXPECTED_EXPIRES_AT.toISOString(),
      amountMajor: TOPUP_AMOUNT_MAJOR,
    });
    expect(insertValues).toHaveBeenCalledTimes(1);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: body.sessionId,
        userId: USER_ID,
        kind: "topup",
        subscriptionId: null,
        currencyCode: "RUB",
        amount: TOPUP_AMOUNT_MINOR,
        status: "pending",
        expiresAt: EXPECTED_EXPIRES_AT,
      })
    );
  });
});

describe("GET /api/payment/status", () => {
  it("answers 401 with a plain-text body without a session", async () => {
    // Arrange
    mockedAuth.mockResolvedValue(null);

    // Act
    const response = await paymentStatusGet(
      createStatusRequest(STATUS_SESSION_ID)
    );

    // Assert
    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Unauthorized");
    expect(checkPaymentStatusRateLimit).not.toHaveBeenCalled();
  });

  it("answers 400 when the sessionId parameter is missing", async () => {
    // Arrange
    arrangeStatusRequester();

    // Act
    const response = await paymentStatusGet(createStatusRequest(null));

    // Assert
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "sessionId parameter is required",
    });
    expect(checkPaymentStatusRateLimit).not.toHaveBeenCalled();
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it.each([
    [
      "the seconds left until the limiter resets",
      NOW.getTime() + 30_500,
      "31",
      {
        error: "Too many requests. Please try again later.",
        retryAfter: NOW.getTime() + 30_500,
      },
    ],
    [
      "60 seconds when the limiter reports no reset time",
      undefined,
      "60",
      { error: "Too many requests. Please try again later." },
    ],
  ])(
    "answers 429 with Retry-After set to %s",
    async (_label, reset, expectedRetryAfter, expectedBody) => {
      // Arrange
      arrangeSession();
      vi.mocked(checkPaymentStatusRateLimit).mockResolvedValue({
        success: false,
        remaining: 0,
        reset,
      });

      // Act
      const response = await paymentStatusGet(
        createStatusRequest(STATUS_SESSION_ID)
      );

      // Assert
      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe(expectedRetryAfter);
      expect(await response.json()).toEqual(expectedBody);
      expect(checkPaymentStatusRateLimit).toHaveBeenCalledWith(CLIENT_IP);
      expect(dbMock.select).not.toHaveBeenCalled();
    }
  );

  it("answers 404 when the user has no intent with that session id", async () => {
    // Arrange
    arrangeStatusRequester();
    selectResults.push([]);

    // Act
    const response = await paymentStatusGet(
      createStatusRequest(STATUS_SESSION_ID)
    );

    // Assert
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Payment intent not found",
    });
  });

  it("reports a pending intent past its expiry as expired without writing anything", async () => {
    // Arrange
    arrangeStatusRequester();
    selectResults.push([
      paymentIntentRow({ expiresAt: new Date(NOW.getTime() - 1) }),
    ]);

    // Act
    const response = await paymentStatusGet(
      createStatusRequest(STATUS_SESSION_ID)
    );

    // Assert: the status is computed for the answer; the stored row is left
    // to the cleanup cron.
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "expired",
      hasActivity: true,
      failureReason: "Payment intent expired after 30 minutes",
    });
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("reports a succeeded top-up together with the fresh balance", async () => {
    // Arrange
    arrangeStatusRequester();
    selectResults.push([
      paymentIntentRow({
        kind: "topup",
        subscriptionId: null,
        amount: TOPUP_AMOUNT_MINOR,
        status: "succeeded",
      }),
    ]);
    vi.mocked(getBalance).mockResolvedValue({
      currencyCode: "RUB",
      subscriptionAmount: 5000,
      topupAmount: TOPUP_AMOUNT_MINOR,
      total: 105_000,
    });

    // Act
    const response = await paymentStatusGet(
      createStatusRequest(STATUS_SESSION_ID)
    );

    // Assert
    expect(await response.json()).toEqual({
      status: "succeeded",
      hasActivity: true,
      topup: {
        amountMinor: TOPUP_AMOUNT_MINOR,
        currencyCode: "RUB",
        balanceTotalMinor: 105_000,
        balanceTopupMinor: TOPUP_AMOUNT_MINOR,
      },
    });
    expect(getBalance).toHaveBeenCalledWith(USER_ID);
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("reports a succeeded subscription intent together with the user subscription", async () => {
    // Arrange: the intent, then the user subscription joined with its plan.
    arrangeStatusRequester();
    selectResults.push(
      [
        paymentIntentRow({
          status: "succeeded",
          externalSubscriptionId: EXTERNAL_SUBSCRIPTION_ID,
        }),
      ],
      [{ id: "user-subscription-1", status: "active", code: PLAN_CODE }]
    );

    // Act
    const response = await paymentStatusGet(
      createStatusRequest(STATUS_SESSION_ID)
    );

    // Assert
    expect(await response.json()).toEqual({
      status: "succeeded",
      hasActivity: true,
      subscription: {
        id: "user-subscription-1",
        planName: PLAN_CODE,
        status: "active",
      },
    });
    expect(getBalance).not.toHaveBeenCalled();
  });

  it("reports a pending intent that has not expired without writing anything", async () => {
    // Arrange
    arrangeStatusRequester();
    selectResults.push([paymentIntentRow()]);

    // Act
    const response = await paymentStatusGet(
      createStatusRequest(STATUS_SESSION_ID)
    );

    // Assert
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "pending",
      hasActivity: false,
    });
    expect(dbMock.update).not.toHaveBeenCalled();
  });
});
