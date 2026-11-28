import { beforeEach, describe, expect, it, vi } from "vitest";

import { createHandler } from "@/server/api/_kit/create-handler";
import { decodeCursor, encodeCursor } from "@/server/api/_kit/pagination";
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
const OTHER_TRANSACTION_ID = "8c2d4e6f-1a3b-4c5d-8e7f-9a0b1c2d3e4f";
const CHAT_ID = "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f";
const ACCESS_TOKEN = "header.payload.signature";

const BEARER = { authorization: `Bearer ${ACCESS_TOKEN}` };

const CREATED_AT = new Date("2026-03-04T05:06:07.123Z");
const CREATED_AT_TEXT = "2026-03-04 05:06:07.123456";

type ErrorBody = { code: string; data?: { reason?: string } };

const handlers = createHandler(v1Router, { prefix: PREFIX });

const get = (path: string, headers: Record<string, string> = BEARER) =>
  handlers.GET(new Request(`${ORIGIN}${PREFIX}${path}`, { headers }));

const makeTransactionRow = (id: string, overrides = {}) => ({
  id,
  type: "usage_debit" as const,
  pool: "subscription" as const,
  currencyCode: "RUB",
  amount: -1250,
  modelId: "openai/gpt-5",
  description: null,
  chatTitle: "Trip plan",
  createdAt: CREATED_AT,
  createdAtText: CREATED_AT_TEXT,
  ...overrides,
});

const makePaymentRow = (id: string, overrides = {}) => ({
  id,
  type: "subscription_renewal" as const,
  currencyCode: "RUB",
  chargedMinor: 99_000,
  createdAt: CREATED_AT,
  createdAtText: CREATED_AT_TEXT,
  ...overrides,
});

const LEAKED_FIELDS_PATTERN =
  /userId|metadata|sc_secret|provider-transaction-id|BalanceAfter/;

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

describe("GET /me/billing/transactions", () => {
  it("lists transactions with money amounts, the total, and exactly the public fields", async () => {
    // Arrange
    vi.mocked(listTransactions).mockResolvedValue({
      transactions: [makeTransactionRow(TRANSACTION_ID)],
      hasMore: false,
      totalCount: 1,
    });

    // Act
    const response = await get("/me/billing/transactions");

    // Assert
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      items: [
        {
          id: TRANSACTION_ID,
          type: "usage_debit",
          pool: "subscription",
          amount: { amountMinor: -1250, currencyCode: "RUB" },
          modelId: "openai/gpt-5",
          chatTitle: "Trip plan",
          description: null,
          createdAt: "2026-03-04T05:06:07.123Z",
        },
      ],
      nextCursor: null,
      totalCount: 1,
    });
    expect(readKeys(body.items[0])).toEqual([
      "amount",
      "chatTitle",
      "createdAt",
      "description",
      "id",
      "modelId",
      "pool",
      "type",
    ]);
    expect(listTransactions).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID,
      limit: 20,
      after: null,
    });
  });

  it("leaks nothing the service row carries beyond the public fields", async () => {
    // Arrange: a row with the owner and raw metadata, as a careless query could return it
    vi.mocked(listTransactions).mockResolvedValue({
      transactions: [
        makeTransactionRow(TRANSACTION_ID, {
          userId: USER_ID,
          metadata: { subscriptionId: "sc_secret" },
          referenceId: "provider-transaction-id",
          subscriptionBalanceAfter: 1,
        }),
      ],
      hasMore: false,
      totalCount: 1,
    });

    // Act
    const body = await (await get("/me/billing/transactions")).json();

    // Assert
    expect(JSON.stringify(body)).not.toMatch(LEAKED_FIELDS_PATTERN);
  });

  it("gives a cursor for the next page and reads it back as the position", async () => {
    // Arrange
    vi.mocked(listTransactions).mockResolvedValue({
      transactions: [
        makeTransactionRow(TRANSACTION_ID),
        makeTransactionRow(OTHER_TRANSACTION_ID),
      ],
      hasMore: true,
      totalCount: 9,
    });

    // Act
    const first = await (await get("/me/billing/transactions?limit=2")).json();
    await get(`/me/billing/transactions?limit=2&cursor=${first.nextCursor}`);

    // Assert
    expect(decodeCursor(first.nextCursor)).toEqual({
      status: "ok",
      position: { createdAt: CREATED_AT_TEXT, id: OTHER_TRANSACTION_ID },
    });
    expect(first.totalCount).toBe(9);
    expect(listTransactions).toHaveBeenLastCalledWith({
      userId: USER_ID,
      limit: 2,
      after: { createdAt: CREATED_AT_TEXT, id: OTHER_TRANSACTION_ID },
    });
  });

  it("serialises a type and a pool it does not know", async () => {
    // Arrange
    vi.mocked(listTransactions).mockResolvedValue({
      transactions: [
        makeTransactionRow(TRANSACTION_ID, {
          type: "gift_card",
          pool: "promo",
        }),
      ],
      hasMore: false,
      totalCount: 1,
    });

    // Act
    const response = await get("/me/billing/transactions");

    // Assert
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items[0]).toMatchObject({ type: "gift_card", pool: "promo" });
  });

  it("answers 200 with an empty page for an account without transactions", async () => {
    // Act
    const response = await get("/me/billing/transactions");

    // Assert
    expect(await response.json()).toEqual({
      items: [],
      nextCursor: null,
      totalCount: 0,
    });
  });

  it.each([
    "not-a-cursor",
    "e30",
    encodeCursor({ createdAt: "2026-02-30 00:00:00", id: CHAT_ID }),
  ])("answers 400 invalid_cursor for the cursor %s", async (cursor) => {
    // Act
    const response = await get(`/me/billing/transactions?cursor=${cursor}`);

    // Assert
    expect(response.status).toBe(400);
    const body = (await response.json()) as ErrorBody;
    expect(body.code).toBe("BAD_REQUEST");
    expect(body.data?.reason).toBe("invalid_cursor");
    expect(listTransactions).not.toHaveBeenCalled();
  });

  it.each(["0", "101", "-1", "abc", "1e1", "5.5", ""])(
    "answers 400 for limit=%s",
    async (limit) => {
      // Act
      const response = await get(`/me/billing/transactions?limit=${limit}`);

      // Assert
      expect(response.status).toBe(400);
      expect(listTransactions).not.toHaveBeenCalled();
    }
  );

  it.each(["1", "100"])("accepts limit=%s", async (limit) => {
    // Act
    const response = await get(`/me/billing/transactions?limit=${limit}`);

    // Assert
    expect(response.status).toBe(200);
  });
});

describe("GET /me/billing/payments", () => {
  it("lists card charges as money, with exactly the public fields", async () => {
    // Arrange
    vi.mocked(listCardPayments).mockResolvedValue({
      payments: [makePaymentRow(TRANSACTION_ID)],
      hasMore: false,
    });

    // Act
    const response = await get("/me/billing/payments");

    // Assert
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      items: [
        {
          id: TRANSACTION_ID,
          type: "subscription_renewal",
          charged: { amountMinor: 99_000, currencyCode: "RUB" },
          createdAt: "2026-03-04T05:06:07.123Z",
        },
      ],
      nextCursor: null,
    });
    expect(readKeys(body.items[0])).toEqual([
      "charged",
      "createdAt",
      "id",
      "type",
    ]);
    expect(listCardPayments).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID,
      limit: 20,
      after: null,
    });
  });

  it("gives a cursor for the next page", async () => {
    // Arrange
    vi.mocked(listCardPayments).mockResolvedValue({
      payments: [makePaymentRow(TRANSACTION_ID)],
      hasMore: true,
    });

    // Act
    const body = await (await get("/me/billing/payments?limit=1")).json();

    // Assert
    expect(decodeCursor(body.nextCursor)).toEqual({
      status: "ok",
      position: { createdAt: CREATED_AT_TEXT, id: TRANSACTION_ID },
    });
  });

  it("serialises a payment type it does not know", async () => {
    // Arrange
    vi.mocked(listCardPayments).mockResolvedValue({
      payments: [makePaymentRow(TRANSACTION_ID, { type: "gift_purchase" })],
      hasMore: false,
    });

    // Act
    const body = await (await get("/me/billing/payments")).json();

    // Assert
    expect(body.items[0].type).toBe("gift_purchase");
  });

  it("answers 200 with an empty page for an account that never paid", async () => {
    // Act
    const response = await get("/me/billing/payments");

    // Assert
    expect(await response.json()).toEqual({ items: [], nextCursor: null });
  });

  it("answers 400 invalid_cursor for a cursor it did not give out", async () => {
    // Act
    const response = await get("/me/billing/payments?cursor=garbage!");

    // Assert
    expect(response.status).toBe(400);
    expect(((await response.json()) as ErrorBody).data?.reason).toBe(
      "invalid_cursor"
    );
    expect(listCardPayments).not.toHaveBeenCalled();
  });

  it.each(["0", "101", "abc"])("answers 400 for limit=%s", async (limit) => {
    // Act
    const response = await get(`/me/billing/payments?limit=${limit}`);

    // Assert
    expect(response.status).toBe(400);
  });
});
