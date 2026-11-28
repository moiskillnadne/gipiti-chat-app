import { beforeEach, describe, expect, it, vi } from "vitest";

import { createHandler } from "@/server/api/_kit/create-handler";
import { v1Router } from "@/server/api/v1/router";
import { getCookieSessionUserId } from "@/server/modules/auth/cookie-session";
import { resolveBearerSession } from "@/server/modules/auth/sessions";
import { getBillingBalance } from "@/server/modules/billing/get-billing-balance";
import { getSpendHistory } from "@/server/modules/billing/get-spend-history";
import { listCardPayments } from "@/server/modules/billing/list-card-payments";
import { listTransactions } from "@/server/modules/billing/list-transactions";
import { getSubscriptionSummary } from "@/server/modules/subscription/get-subscription-summary";

// The handler, the router, the middlewares, the schemas, the mappers and the
// cursor codec are real. The billing services and what reaches outside the
// process are replaced, as in `chats-http.test.ts`.
vi.mock("server-only", () => ({}));
vi.mock("@/server/db/connection", () => ({ db: {} }));
vi.mock("@/server/flags", () => ({
  isSignupEnabled: vi.fn(),
  isTopupEnabled: { run: vi.fn() },
}));
vi.mock("@/server/modules/auth/cookie-session", () => ({
  getCookieSessionUserId: vi.fn(),
}));
vi.mock("@/server/modules/auth/sessions", () => ({
  resolveBearerSession: vi.fn(),
}));
vi.mock("@/server/modules/auth/authenticate-credentials", () => ({
  authenticateCredentials: vi.fn(),
}));
vi.mock("@/server/modules/auth/change-password", () => ({
  changePassword: vi.fn(),
}));
vi.mock("@/server/modules/auth/register-user", () => ({
  registerUser: vi.fn(),
}));
vi.mock("@/server/modules/auth/request-password-reset", () => ({
  requestPasswordReset: vi.fn(),
}));
vi.mock("@/server/modules/auth/reset-password", () => ({
  resetPassword: vi.fn(),
}));
vi.mock("@/server/modules/auth/send-verification-code", () => ({
  sendVerificationCode: vi.fn(),
}));
vi.mock("@/server/modules/auth/verify-email-code", () => ({
  verifyEmailCode: vi.fn(),
}));
vi.mock("@/server/modules/billing/currencies", () => ({
  getMinorUnits: vi.fn(),
}));
vi.mock("@/server/modules/billing/subscriptions", () => ({
  listActiveSubscriptionsWithPrices: vi.fn(),
}));
vi.mock("@/server/modules/billing/balance", () => ({ getBalance: vi.fn() }));
vi.mock("@/server/modules/users/queries/get-by-id", () => ({
  getUserById: vi.fn(),
}));
vi.mock(
  "@/server/modules/subscription/queries/get-active-user-subscription",
  () => ({
    getActiveUserSubscription: vi.fn(),
  })
);
vi.mock("@/server/modules/billing/get-billing-balance", () => ({
  getBillingBalance: vi.fn(),
}));
vi.mock("@/server/modules/billing/get-spend-history", () => ({
  getSpendHistory: vi.fn(),
}));
vi.mock("@/server/modules/billing/list-card-payments", () => ({
  listCardPayments: vi.fn(),
}));
vi.mock("@/server/modules/billing/list-transactions", () => ({
  listTransactions: vi.fn(),
}));
vi.mock("@/server/modules/subscription/get-subscription-summary", () => ({
  getSubscriptionSummary: vi.fn(),
}));

const ORIGIN = "https://gipiti.test";
const PREFIX = "/api/v1";
const USER_ID = "3f0c1b7e-7c0a-4a52-9d1b-1d2a3b4c5d6e";
const SESSION_ID = "9d1b3f0c-1b7e-4a52-8c0a-6e5d4c3b2a1d";
const TRANSACTION_ID = "5a1e0f64-2b7c-4d3e-9a8b-0c1d2e3f4a5b";
const CHAT_ID = "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f";
const ACCESS_TOKEN = "header.payload.signature";

const BEARER = { authorization: `Bearer ${ACCESS_TOKEN}` };

const CREATED_AT = new Date("2026-03-04T05:06:07.123Z");

type ErrorBody = { code: string; data?: { reason?: string } };

const handlers = createHandler(v1Router, { prefix: PREFIX });

const get = (path: string, headers: Record<string, string> = BEARER) =>
  handlers.GET(new Request(`${ORIGIN}${PREFIX}${path}`, { headers }));

const makeSubscriptionSummary = (overrides = {}) => ({
  planCode: "basic_monthly",
  displayName: "Basic",
  billingPeriod: "monthly" as const,
  status: "active",
  state: "active" as const,
  currentPeriodStart: new Date("2026-03-01T00:00:00.000Z"),
  currentPeriodEnd: new Date("2026-04-01T00:00:00.000Z"),
  cancelAtPeriodEnd: false,
  cancelledAt: null,
  currencyCode: "RUB",
  priceMinor: 99_000,
  nextPayment: {
    date: new Date("2026-04-01T00:00:00.000Z"),
    amountMinor: 99_000,
  },
  cardMask: "Visa ****4242",
  ...overrides,
});

const readKeys = (value: object): string[] => Object.keys(value).sort();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCookieSessionUserId).mockResolvedValue(null);
  vi.mocked(resolveBearerSession).mockImplementation(async (token) =>
    token === ACCESS_TOKEN ? { userId: USER_ID, sessionId: SESSION_ID } : null
  );
  vi.mocked(getBillingBalance).mockResolvedValue({
    balance: null,
    spend: null,
  });
  vi.mocked(listTransactions).mockResolvedValue({
    transactions: [],
    hasMore: false,
    totalCount: 0,
  });
  vi.mocked(getSpendHistory).mockResolvedValue({
    currencyCode: "RUB",
    chats: [],
    recentSpendMinor: 0,
  });
  vi.mocked(listCardPayments).mockResolvedValue({
    payments: [],
    hasMore: false,
  });
  vi.mocked(getSubscriptionSummary).mockResolvedValue(null);
});

describe("every billing read", () => {
  it.each([
    "/me/billing/balance",
    "/me/billing/transactions",
    "/me/billing/spend-history",
    "/me/billing/payments",
    "/me/subscription",
  ])("%s answers 401 to an anonymous caller", async (path) => {
    // Act
    const response = await get(path, {});

    // Assert
    expect(response.status).toBe(401);
    expect(((await response.json()) as ErrorBody).data?.reason).toBe(
      "not_authenticated"
    );
  });
});

describe("GET /me/billing/balance", () => {
  it("returns both pools, the total and the spend progress as money", async () => {
    // Arrange
    vi.mocked(getBillingBalance).mockResolvedValue({
      balance: {
        currencyCode: "RUB",
        subscriptionAmount: 90_000,
        topupAmount: 5000,
        total: 95_000,
      },
      spend: {
        referenceTotal: 100_000,
        currentTotal: 95_000,
        spentPercent: 5,
        epochKey: TRANSACTION_ID,
      },
    });

    // Act
    const response = await get("/me/billing/balance");

    // Assert
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      balance: {
        subscription: { amountMinor: 90_000, currencyCode: "RUB" },
        topup: { amountMinor: 5000, currencyCode: "RUB" },
        total: { amountMinor: 95_000, currencyCode: "RUB" },
      },
      spend: { spentPercent: 5, epochKey: TRANSACTION_ID },
    });
    expect(getBillingBalance).toHaveBeenCalledExactlyOnceWith(USER_ID);
  });

  it("answers 200 with nulls for an account without a balance row", async () => {
    // Act
    const response = await get("/me/billing/balance");

    // Assert
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ balance: null, spend: null });
  });
});

describe("GET /me/billing/spend-history", () => {
  it("returns per-chat spend and the last seven days as money", async () => {
    // Arrange
    vi.mocked(getSpendHistory).mockResolvedValue({
      currencyCode: "RUB",
      chats: [
        {
          chatId: CHAT_ID,
          title: "Trip plan",
          model: "GPT-5",
          messages: 4,
          searches: 1,
          images: 0,
          videos: 2,
          totalMinor: 4200,
          last: CREATED_AT,
        },
      ],
      recentSpendMinor: 9100,
    });

    // Act
    const response = await get("/me/billing/spend-history");

    // Assert
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      items: [
        {
          chatId: CHAT_ID,
          title: "Trip plan",
          model: "GPT-5",
          messages: 4,
          searches: 1,
          images: 0,
          videos: 2,
          total: { amountMinor: 4200, currencyCode: "RUB" },
          lastActivityAt: "2026-03-04T05:06:07.123Z",
        },
      ],
      recentSpend: { amountMinor: 9100, currencyCode: "RUB" },
    });
    expect(readKeys(body.items[0])).toEqual([
      "chatId",
      "images",
      "lastActivityAt",
      "messages",
      "model",
      "searches",
      "title",
      "total",
      "videos",
    ]);
    expect(getSpendHistory).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID,
      limit: 6,
    });
  });

  it("passes the limit on and answers zero money for an account that spent nothing", async () => {
    // Act
    const response = await get("/me/billing/spend-history?limit=3");

    // Assert
    expect(await response.json()).toEqual({
      items: [],
      recentSpend: { amountMinor: 0, currencyCode: "RUB" },
    });
    expect(getSpendHistory).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID,
      limit: 3,
    });
  });

  it.each(["0", "101", "abc", "1e1"])(
    "answers 400 for limit=%s",
    async (limit) => {
      // Act
      const response = await get(`/me/billing/spend-history?limit=${limit}`);

      // Assert
      expect(response.status).toBe(400);
      expect(getSpendHistory).not.toHaveBeenCalled();
    }
  );
});

describe("GET /me/subscription", () => {
  it("returns the plan, period, price, next payment and card mask, and nothing of the provider", async () => {
    // Arrange
    vi.mocked(getSubscriptionSummary).mockResolvedValue(
      makeSubscriptionSummary()
    );

    // Act
    const response = await get("/me/subscription");

    // Assert
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      subscription: {
        planCode: "basic_monthly",
        displayName: "Basic",
        billingPeriod: "monthly",
        status: "active",
        state: "active",
        currentPeriodStart: "2026-03-01T00:00:00.000Z",
        currentPeriodEnd: "2026-04-01T00:00:00.000Z",
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        price: { amountMinor: 99_000, currencyCode: "RUB" },
        nextPayment: {
          date: "2026-04-01T00:00:00.000Z",
          amount: { amountMinor: 99_000, currencyCode: "RUB" },
        },
        cardMask: "Visa ****4242",
      },
    });
    expect(readKeys(body.subscription)).toEqual([
      "billingPeriod",
      "cancelAtPeriodEnd",
      "cancelledAt",
      "cardMask",
      "currentPeriodEnd",
      "currentPeriodStart",
      "displayName",
      "nextPayment",
      "planCode",
      "price",
      "state",
      "status",
    ]);
    expect(getSubscriptionSummary).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID,
    });
  });

  it("answers 200 with null for an account that never subscribed", async () => {
    // Act
    const response = await get("/me/subscription");

    // Assert
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ subscription: null });
  });

  it("returns a cancelled subscription with its cancel flags and no next payment", async () => {
    // Arrange
    vi.mocked(getSubscriptionSummary).mockResolvedValue(
      makeSubscriptionSummary({
        status: "active",
        state: "cancelled",
        cancelAtPeriodEnd: true,
        cancelledAt: new Date("2026-03-10T08:00:00.000Z"),
        nextPayment: null,
      })
    );

    // Act
    const body = await (await get("/me/subscription")).json();

    // Assert
    expect(body.subscription).toMatchObject({
      state: "cancelled",
      cancelAtPeriodEnd: true,
      cancelledAt: "2026-03-10T08:00:00.000Z",
      nextPayment: null,
    });
  });

  it("passes an ended subscription through with its state none and no next payment", async () => {
    // Arrange: the row still has a price and a card, as a real expired row does
    vi.mocked(getSubscriptionSummary).mockResolvedValue(
      makeSubscriptionSummary({
        status: "expired",
        state: "none",
        nextPayment: null,
      })
    );

    // Act
    const body = await (await get("/me/subscription")).json();

    // Assert
    expect(body.subscription).toMatchObject({
      status: "expired",
      state: "none",
      price: { amountMinor: 99_000, currencyCode: "RUB" },
      nextPayment: null,
      cardMask: "Visa ****4242",
    });
  });

  it("returns a past-due retry without an amount, and a currency other than RUB", async () => {
    // Arrange
    vi.mocked(getSubscriptionSummary).mockResolvedValue(
      makeSubscriptionSummary({
        status: "past_due",
        state: "past_due",
        currencyCode: "USD",
        priceMinor: 1000,
        nextPayment: {
          date: new Date("2026-04-02T00:00:00.000Z"),
          amountMinor: null,
        },
      })
    );

    // Act
    const body = await (await get("/me/subscription")).json();

    // Assert
    expect(body.subscription.price).toEqual({
      amountMinor: 1000,
      currencyCode: "USD",
    });
    expect(body.subscription.nextPayment).toEqual({
      date: "2026-04-02T00:00:00.000Z",
      amount: null,
    });
  });

  it("serialises a status, a state and a billing period it does not know", async () => {
    // Arrange
    vi.mocked(getSubscriptionSummary).mockResolvedValue(
      makeSubscriptionSummary({
        status: "paused",
        state: "paused",
        billingPeriod: "quarterly",
      })
    );

    // Act
    const response = await get("/me/subscription");

    // Assert
    expect(response.status).toBe(200);
    expect((await response.json()).subscription).toMatchObject({
      status: "paused",
      state: "paused",
      billingPeriod: "quarterly",
    });
  });
});
