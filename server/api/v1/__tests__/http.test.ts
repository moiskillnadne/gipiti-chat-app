import { beforeEach, describe, expect, it, vi } from "vitest";

import { chatModels, DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { createHandler } from "@/server/api/_kit/create-handler";
import { KNOWN_MODEL_PROVIDERS } from "@/server/api/v1/_schemas/model";
import { v1Router } from "@/server/api/v1/router";
import type { Subscription, User, UserSubscription } from "@/server/db/schema";
import { isSignupEnabled, isTopupEnabled } from "@/server/flags";
import { getCookieSessionUserId } from "@/server/modules/auth/cookie-session";
import { resolveBearerSession } from "@/server/modules/auth/sessions";
import { getBalance } from "@/server/modules/billing/balance";
import { getMinorUnits } from "@/server/modules/billing/currencies";
import {
  listActiveSubscriptionsWithPrices,
  type SubscriptionWithPrices,
} from "@/server/modules/billing/subscriptions";
import { getActiveUserSubscription } from "@/server/modules/subscription/queries/get-active-user-subscription";
import { getUserById } from "@/server/modules/users/queries/get-by-id";

// The handler, the router, the middlewares, the mappers and the model
// registry are real. Only what reaches outside the process is replaced.
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
// The router also holds the account endpoints, whose services reach the mail
// sender. They have their own suite (`account-http.test.ts`).
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

const ORIGIN = "http://localhost";
const PREFIX = "/api/v1";
const USER_ID = "3f0c1b7e-7c0a-4a52-9d1b-1d2a3b4c5d6e";
const OPENAPI_DOCUMENT = { openapi: "3.1.1", paths: {} };
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const SESSION_ID = "9d1b3f0c-1b7e-4a52-7c0a-6e5d4c3b2a1d";
const ACCESS_TOKEN = "header.payload.signature";
const BEARER = { authorization: `Bearer ${ACCESS_TOKEN}` };

/** The reader of the browser session, as the principal guard calls it. */
const getCookieSession = vi.mocked(getCookieSessionUserId);

const handlers = createHandler(v1Router, {
  prefix: PREFIX,
  openApiDocument: OPENAPI_DOCUMENT,
});

const call = (
  path: string,
  init: RequestInit & { method?: keyof typeof handlers } = {}
): Promise<Response> =>
  handlers[init.method ?? "GET"](
    new Request(`${ORIGIN}${PREFIX}${path}`, init)
  );

const userRow = (overrides: Partial<User> = {}): User =>
  ({
    id: USER_ID,
    email: "user@example.test",
    emailVerified: true,
    isTester: false,
    ...overrides,
  }) as User;

const catalogEntry = (
  code: string,
  overrides: Partial<Subscription> = {}
): SubscriptionWithPrices => ({
  subscription: {
    id: `id-${code}`,
    code,
    displayName: `Plan ${code}`,
    billingPeriod: "monthly",
    billingPeriodCount: 1,
    isActive: true,
    ...overrides,
  } as Subscription,
  prices: [{ currencyCode: "RUB", price: 99_900 }],
});

const signIn = (): void => {
  getCookieSession.mockResolvedValue(USER_ID);
};

/** The access token in `BEARER` stands for the user from here on. */
const acceptBearerToken = (): void => {
  vi.mocked(resolveBearerSession).mockResolvedValue({
    userId: USER_ID,
    sessionId: SESSION_ID,
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  getCookieSession.mockResolvedValue(null);
  vi.mocked(resolveBearerSession).mockResolvedValue(null);
  vi.mocked(isSignupEnabled).mockResolvedValue(true);
  vi.mocked(isTopupEnabled.run).mockResolvedValue(false);
  vi.mocked(getMinorUnits).mockResolvedValue(2);
  vi.mocked(listActiveSubscriptionsWithPrices).mockResolvedValue([
    catalogEntry("basic_monthly"),
    catalogEntry("tester_paid", { billingPeriod: "daily" }),
  ]);
  vi.mocked(getUserById).mockResolvedValue(userRow());
  vi.mocked(getActiveUserSubscription).mockResolvedValue(null);
  vi.mocked(getBalance).mockResolvedValue(null);
});

describe("the v1 handler", () => {
  it("answers an unknown path with the error envelope and 404", async () => {
    // Act
    const response = await call("/does-not-exist");

    // Assert
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({
      defined: false,
      code: "NOT_FOUND",
      status: 404,
      message: "Not found.",
    });
  });

  it("answers a known path called with the wrong method with the same 404", async () => {
    // Act
    const response = await call("/config", { method: "DELETE" });

    // Assert
    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe("NOT_FOUND");
  });

  it("adds a request id and forbids caching on every answer", async () => {
    // Act
    const found = await call("/models");
    const missing = await call("/does-not-exist");

    // Assert
    for (const response of [found, missing]) {
      expect(response.headers.get("x-request-id")).toMatch(UUID_PATTERN);
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("echoes a well-formed request id and replaces a malformed one", async () => {
    // Act
    const echoed = await call("/models", {
      headers: { "x-request-id": "client-request-0001" },
    });
    const replaced = await call("/models", {
      headers: { "x-request-id": "bad id\twith spaces" },
    });

    // Assert
    expect(echoed.headers.get("x-request-id")).toBe("client-request-0001");
    expect(replaced.headers.get("x-request-id")).toMatch(UUID_PATTERN);
  });

  it("sends no CORS headers", async () => {
    // Act
    const response = await call("/config", {
      headers: { origin: "https://elsewhere.example" },
    });

    // Assert
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("answers an unexpected failure with a 500 that carries no detail, and logs it", async () => {
    // Arrange
    const failure = new Error("connect ECONNREFUSED ep-secret-host:5432");
    vi.mocked(getMinorUnits).mockRejectedValue(failure);
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockReturnValue(undefined);

    // Act
    const response = await call("/config");
    const bodyText = await response.text();

    // Assert
    expect(response.status).toBe(500);
    expect(JSON.parse(bodyText)).toEqual({
      defined: false,
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Internal server error",
    });
    expect(bodyText).not.toContain("ep-secret-host");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(response.headers.get("x-request-id") ?? "none"),
      failure
    );
  });

  it("answers a handler result that breaks its own schema with a plain 500", async () => {
    // Arrange: the plan schema requires a positive period count.
    vi.mocked(listActiveSubscriptionsWithPrices).mockResolvedValue([
      catalogEntry("basic_monthly", { billingPeriodCount: 0 }),
    ]);
    vi.spyOn(console, "error").mockReturnValue(undefined);

    // Act
    const response = await call("/plans");

    // Assert
    expect(response.status).toBe(500);
    expect((await response.json()).message).toBe("Internal server error");
  });

  it("answers HEAD like GET, without a body", async () => {
    // Act
    const response = await call("/models", { method: "HEAD" });

    // Assert
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("answers HEAD for an unknown path with 404", async () => {
    // Act
    const response = await call("/does-not-exist", { method: "HEAD" });

    // Assert
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
  });

  it.each(["/config", "/models", "/openapi.json"])(
    "serves %s, which identifies nobody, whatever credentials are sent",
    async (path) => {
      // Arrange
      signIn();

      // Act
      const response = await call(path, { headers: BEARER });

      // Assert
      expect(response.status).toBe(200);
      expect(getCookieSession).not.toHaveBeenCalled();
      expect(resolveBearerSession).not.toHaveBeenCalled();
    }
  );

  it("serves the OpenAPI document it was given", async () => {
    // Act
    const response = await call("/openapi.json");

    // Assert
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(OPENAPI_DOCUMENT);
  });
});

describe("GET /config", () => {
  it("returns the billing settings as money in minor units, without a session", async () => {
    // Act
    const response = await call("/config");
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(getCookieSession).not.toHaveBeenCalled();
    expect(body.bonuses).toEqual({
      welcome: { amountMinor: 5000, currencyCode: "RUB" },
      emailConfirm: { amountMinor: 10_000, currencyCode: "RUB" },
      onboardingQuiz: { amountMinor: 5000, currencyCode: "RUB" },
    });
    expect(body.topup.minimum).toEqual({
      amountMinor: 50_000,
      currencyCode: "RUB",
    });
    expect(body.topup.maximum).toEqual({
      amountMinor: 5_000_000,
      currencyCode: "RUB",
    });
    expect(body.topup.presets).toHaveLength(4);
    expect(body.clients.ios).toEqual({
      minSupportedVersion: null,
      latestVersion: null,
      updateUrl: null,
    });
  });

  it.each([true, false])("reports the signup flag as %s", async (flag) => {
    // Arrange
    vi.mocked(isSignupEnabled).mockResolvedValue(flag);

    // Act
    const body = await (await call("/config")).json();

    // Assert
    expect(body.features).toEqual({ signup: flag });
  });
});

describe("GET /models", () => {
  it("lists the pickable models with the default, without a session", async () => {
    // Act
    const response = await call("/models");
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body.defaultModelId).toBe(DEFAULT_CHAT_MODEL);
    expect(body.items.length).toBeGreaterThan(0);
    expect(
      body.items.some((item: { id: string }) => item.id === DEFAULT_CHAT_MODEL)
    ).toBe(true);
  });

  it("sends names and descriptions as text, not as translation keys", async () => {
    // Arrange: in the registry both fields are keys such as `grok47.name`.
    const registryKeys = new Set(
      chatModels.flatMap((model) => [model.name, model.description])
    );

    // Act
    const body = await (await call("/models")).json();
    const sentTexts: string[] = body.items.flatMap(
      (item: { name: string; description: string }) => [
        item.name,
        item.description,
      ]
    );

    // Assert
    expect(sentTexts.filter((text) => registryKeys.has(text))).toEqual([]);
    // A key with no translation comes back as `modelList.<key>`.
    expect(sentTexts.filter((text) => text.startsWith("modelList."))).toEqual(
      []
    );
    expect(sentTexts.every((text) => text.length > 0)).toBe(true);
  });

  it("exposes only the five public fields of a model", async () => {
    // Act
    const body = await (await call("/models")).json();

    // Assert: no provider options, thinking or generation configs.
    for (const item of body.items) {
      expect(Object.keys(item).sort()).toEqual([
        "capabilities",
        "description",
        "id",
        "name",
        "provider",
      ]);
      expect(Object.keys(item.capabilities).sort()).toEqual([
        "attachments",
        "imageGeneration",
        "reasoning",
        "toolCalling",
        "videoGeneration",
      ]);
    }
  });

  it("leaves out models that are hidden in the UI", async () => {
    // Arrange
    const hiddenIds = chatModels
      .filter((model) => model.showInUI === false)
      .map((model) => model.id);

    // Act
    const body = await (await call("/models")).json();
    const listedIds = new Set(
      body.items.map((item: { id: string }) => item.id)
    );

    // Assert
    expect(hiddenIds.filter((id) => listedIds.has(id))).toEqual([]);
  });

  it("documents every provider the registry uses as a known value", () => {
    // Arrange
    const knownProviders = new Set<string>(KNOWN_MODEL_PROVIDERS);

    // Act
    const undocumentedProviders = chatModels
      .map((model) => model.provider)
      .filter(
        (provider): provider is NonNullable<typeof provider> =>
          provider !== undefined && !knownProviders.has(provider)
      );

    // Assert
    expect(undocumentedProviders).toEqual([]);
  });
});

describe("GET /plans", () => {
  const listedCodes = async (): Promise<string[]> => {
    const body = await (await call("/plans")).json();
    return body.items.map((item: { code: string }) => item.code);
  };

  it("lists the public plans for an anonymous caller", async () => {
    // Act
    const response = await call("/plans");
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body.items).toEqual([
      {
        code: "basic_monthly",
        displayName: "Plan basic_monthly",
        billingPeriod: "monthly",
        billingPeriodCount: 1,
        prices: [{ amountMinor: 99_900, currencyCode: "RUB" }],
      },
    ]);
    expect(getUserById).not.toHaveBeenCalled();
  });

  it("hides the tester-only plan from a regular user", async () => {
    // Arrange
    signIn();

    // Act
    const codes = await listedCodes();

    // Assert
    expect(codes).toEqual(["basic_monthly"]);
  });

  it("shows the tester-only plan to a tester, by the User row", async () => {
    // Arrange
    signIn();
    vi.mocked(getUserById).mockResolvedValue(userRow({ isTester: true }));

    // Act
    const codes = await listedCodes();

    // Assert
    expect(codes).toEqual(["basic_monthly", "tester_paid"]);
    expect(getUserById).toHaveBeenCalledWith(USER_ID);
  });

  it("falls back to the code when a plan has no display name", async () => {
    // Arrange
    vi.mocked(listActiveSubscriptionsWithPrices).mockResolvedValue([
      catalogEntry("basic_monthly", { displayName: null }),
    ]);

    // Act
    const body = await (await call("/plans")).json();

    // Assert
    expect(body.items[0].displayName).toBe("basic_monthly");
  });

  it("refuses a token that is not accepted instead of treating the caller as anonymous", async () => {
    // Act
    const response = await call("/plans", { headers: BEARER });

    // Assert
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      code: "UNAUTHORIZED",
      data: { reason: "invalid_token" },
    });
  });

  it("refuses an Authorization header of another scheme", async () => {
    // Act
    const response = await call("/plans", {
      headers: { authorization: "Basic dXNlcjpwYXNz" },
    });

    // Assert
    expect(response.status).toBe(401);
    expect((await response.json()).data).toEqual({
      reason: "unsupported_authorization",
    });
  });
});

describe("GET /me", () => {
  it("answers 401 in the error envelope without a session", async () => {
    // Act
    const response = await call("/me");

    // Assert
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
      message: "Authentication is required.",
    });
    expect(getUserById).not.toHaveBeenCalled();
  });

  it("refuses a token that is not accepted even when a browser session is present", async () => {
    // Arrange
    signIn();

    // Act
    const response = await call("/me", { headers: BEARER });

    // Assert
    expect(response.status).toBe(401);
    expect((await response.json()).data).toEqual({ reason: "invalid_token" });
    expect(getCookieSession).not.toHaveBeenCalled();
    expect(getUserById).not.toHaveBeenCalled();
  });

  it("answers a caller with an access token, without a browser session", async () => {
    // Arrange
    acceptBearerToken();
    vi.mocked(getUserById).mockResolvedValue(userRow());

    // Act
    const response = await call("/me", { headers: BEARER });

    // Assert
    expect(response.status).toBe(200);
    expect((await response.json()).id).toBe(USER_ID);
    expect(resolveBearerSession).toHaveBeenCalledWith(ACCESS_TOKEN);
    expect(getCookieSession).not.toHaveBeenCalled();
  });

  it("returns the user from the database with the balance as money", async () => {
    // Arrange
    signIn();
    vi.mocked(getUserById).mockResolvedValue(userRow({ isTester: true }));
    vi.mocked(getActiveUserSubscription).mockResolvedValue({
      id: "user-subscription-1",
    } as UserSubscription);
    vi.mocked(getBalance).mockResolvedValue({
      currencyCode: "RUB",
      subscriptionAmount: 90_000,
      topupAmount: 5000,
      total: 95_000,
    });
    vi.mocked(isTopupEnabled.run).mockResolvedValue(true);

    // Act
    const response = await call("/me");

    // Assert
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: USER_ID,
      email: "user@example.test",
      emailVerified: true,
      isTester: true,
      hasActiveSubscription: true,
      balance: {
        subscription: { amountMinor: 90_000, currencyCode: "RUB" },
        topup: { amountMinor: 5000, currencyCode: "RUB" },
        total: { amountMinor: 95_000, currencyCode: "RUB" },
      },
      features: { topup: true },
    });
    expect(getActiveUserSubscription).toHaveBeenCalledWith({ userId: USER_ID });
    expect(isTopupEnabled.run).toHaveBeenCalledWith({
      identify: { user: { id: USER_ID } },
    });
  });

  it("returns a null balance for an account without a balance row", async () => {
    // Arrange
    signIn();

    // Act
    const body = await (await call("/me")).json();

    // Assert
    expect(body.balance).toBeNull();
    expect(body.hasActiveSubscription).toBe(false);
    expect(body.features).toEqual({ topup: false });
  });

  it("answers 401 when the account behind the session no longer exists", async () => {
    // Arrange
    signIn();
    vi.mocked(getUserById).mockResolvedValue(null);

    // Act
    const response = await call("/me");

    // Assert
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("UNAUTHORIZED");
  });
});
