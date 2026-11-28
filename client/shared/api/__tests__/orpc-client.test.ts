import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/v1/[[...rest]]/route";
import {
  getApiErrorCode,
  getApiErrorMessageKey,
  getApiErrorReason,
  isAbortError,
  isApiError,
} from "@/client/shared/api/errors";
import { api } from "@/client/shared/api/orpc-client";
import { getMinorUnits } from "@/lib/billing/currencies";
import { isSignupEnabled, isTopupEnabled } from "@/server/flags";
import { getCookieSessionUserId } from "@/server/modules/auth/cookie-session";
import { requestPasswordReset } from "@/server/modules/auth/request-password-reset";
import { resolveBearerSession } from "@/server/modules/auth/sessions";

// The route handler, the router and the contract are real; only what reaches
// outside the process is replaced (the same set as `server/api/v1/__tests__`).
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
vi.mock("@/lib/billing/currencies", () => ({ getMinorUnits: vi.fn() }));
vi.mock("@/lib/billing/subscriptions", () => ({
  listActiveSubscriptionsWithPrices: vi.fn(),
}));
vi.mock("@/lib/billing/balance", () => ({ getBalance: vi.fn() }));
vi.mock("@/server/modules/users/queries/get-by-id", () => ({
  getUserById: vi.fn(),
}));
vi.mock("@/lib/db/query/subscription/get-active-user-subscription", () => ({
  getActiveUserSubscription: vi.fn(),
}));

const ORIGIN = "http://localhost";

/** Hands every request the client makes to the real route handler. */
const routeFetchToHandler = () =>
  vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const handler = request.method === "POST" ? POST : GET;

    return handler(request);
  });

describe("the web API client against the real v1 route handler", () => {
  beforeEach(() => {
    vi.stubGlobal("location", { origin: ORIGIN });
    vi.mocked(getCookieSessionUserId).mockResolvedValue(null);
    vi.mocked(resolveBearerSession).mockResolvedValue(null);
    vi.mocked(isSignupEnabled).mockResolvedValue(true);
    vi.mocked(isTopupEnabled.run).mockResolvedValue(false);
    vi.mocked(getMinorUnits).mockResolvedValue(2);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns typed data from a public read", async () => {
    // Arrange
    const fetchSpy = routeFetchToHandler();

    // Act
    const config = await api.config.get();

    // Assert
    expect(config.features.signup).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [sentRequest] = fetchSpy.mock.calls[0];
    expect(new URL((sentRequest as Request).url).pathname).toBe(
      "/api/v1/config"
    );
  });

  it("rejects an anonymous call to a signed-in endpoint with a readable error", async () => {
    // Arrange
    routeFetchToHandler();

    // Act
    const failure = await api.me.get().catch((error: unknown) => error);

    // Assert
    expect(isApiError(failure)).toBe(true);
    expect(getApiErrorCode(failure)).toBe("UNAUTHORIZED");
    expect(getApiErrorReason(failure)).toBe("not_authenticated");
    expect(getApiErrorMessageKey(failure)).toBe("api.UNAUTHORIZED");
  });

  it("passes a response field the contract does not know through untouched", async () => {
    // Arrange: a newer server adds a field the page was built without.
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const request =
        input instanceof Request ? input : new Request(input, init);
      const answer = await GET(request);
      const body: Record<string, unknown> = await answer.json();

      return Response.json({ ...body, addedByNewerServer: "kept" });
    });

    // Act
    const config = await api.config.get();

    // Assert
    expect(config).toHaveProperty("addedByNewerServer", "kept");
  });

  it("maps a request that never reached the server to the network message", async () => {
    // Arrange
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("Failed to fetch")
    );

    // Act
    const failure = await api.config.get().catch((error: unknown) => error);

    // Assert
    expect(isApiError(failure)).toBe(false);
    expect(getApiErrorMessageKey(failure)).toBe("api.network");
  });

  it("rejects with an abort error when the call is cancelled", async () => {
    // Arrange
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new DOMException("", "AbortError")
    );

    // Act
    const failure = await api.config.get().catch((error: unknown) => error);

    // Assert
    expect(isAbortError(failure)).toBe(true);
    expect(getApiErrorMessageKey(failure)).toBeNull();
  });

  it("sends a state-changing call as a POST with a JSON body", async () => {
    // Arrange
    vi.mocked(requestPasswordReset).mockResolvedValue({ status: "sent" });
    const fetchSpy = routeFetchToHandler();

    // Act
    await api.auth.password.forgot({ email: "user@example.test" });

    // Assert
    const [sentRequest] = fetchSpy.mock.calls[0];
    expect((sentRequest as Request).method).toBe("POST");
    expect(requestPasswordReset).toHaveBeenCalledExactlyOnceWith({
      email: "user@example.test",
    });
  });

  it("resolves to undefined for an answer with status 204", async () => {
    // Arrange
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 })
    );

    // Act
    const result = await api.auth.password.reset({
      token: "token",
      password: "a-long-enough-password-1",
    });

    // Assert
    expect(result).toBeUndefined();
  });

  it("turns a platform answer that is not JSON into an API error", async () => {
    // Arrange: the platform refuses a big body before the function runs.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Request Entity Too Large", {
        status: 413,
        headers: { "content-type": "text/plain" },
      })
    );

    // Act
    const failure = await api.config.get().catch((error: unknown) => error);

    // Assert
    expect(isApiError(failure)).toBe(true);
    expect(getApiErrorCode(failure)).toBe("PAYLOAD_TOO_LARGE");
    expect(getApiErrorMessageKey(failure)).toBe("api.PAYLOAD_TOO_LARGE");
  });

  it("fails with a clear message where there is no origin", async () => {
    // Arrange
    vi.unstubAllGlobals();

    // Act
    const failure = await api.config.get().catch((error: unknown) => error);

    // Assert
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain("no browser origin");
  });
});
