import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { DELETE, GET, PATCH, POST, PUT } from "@/app/api/v1/[[...rest]]/route";
import type { CallerAccess } from "@/server/api/_kit/caller-access";
import { getCookieSessionUserId } from "@/server/modules/auth/cookie-session";
import { resolveBearerSession } from "@/server/modules/auth/sessions";

// The real route file, handler, router and middlewares. Only what reaches
// outside the process is replaced, as in `http.test.ts`.
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
// `GET /prompts` reads no credentials, so it reaches its query.
vi.mock("@/server/modules/prompts/queries/get-active-prompts", () => ({
  getActivePrompts: vi.fn().mockResolvedValue([]),
}));

const SNAPSHOT_PATH = join(
  process.cwd(),
  "server/api/v1/openapi.snapshot.json"
);
const ORIGIN = "http://localhost";
const PREFIX = "/api/v1";
const SOME_UUID = "3f0c1b7e-7c0a-4a52-9d1b-1d2a3b4c5d6e";

type SecurityRequirement = Record<string, string[]>;
type ErrorBody = { data?: { reason?: string } } | null;

type OperationUnderTest = {
  name: string;
  method: string;
  path: string;
  declaredAccess: CallerAccess;
  hasRequestBody: boolean;
  hasRequiredQuery: boolean;
};

/**
 * A body that passes input validation, per operation that takes one. Input
 * is validated before the authentication middleware runs, so an empty body
 * would be answered with 400 whatever the operation declares, and a
 * `required` operation that lost its `requireAuth` would go unnoticed. An
 * operation with a body but without an entry here fails the test.
 */
const VALID_BODY_BY_OPERATION: Record<string, unknown> = {
  "POST /auth/register": {
    email: "user@example.test",
    password: "Str0ng!Passw0rd",
    client: { platform: "ios" },
  },
  "POST /auth/login": {
    email: "user@example.test",
    password: "Str0ng!Passw0rd",
    client: { platform: "ios" },
  },
  "POST /auth/refresh": { refreshToken: "r".repeat(40) },
  "POST /auth/email-verification/verify": { code: "123456" },
  "POST /auth/password/forgot": { email: "user@example.test" },
  "POST /auth/password/reset": {
    token: "reset-token",
    password: "Str0ng!Passw0rd",
  },
  "POST /auth/password/change": {
    currentPassword: "Str0ng!Passw0rd",
    newPassword: "An0ther!Passw0rd",
  },
  "PUT /me/quizzes/{quizKey}": { answers: { sphere: "it" } },
  "PUT /chats/{chatId}/messages/{messageId}/vote": { isUpvoted: true },
};

/**
 * A query string that passes input validation, per operation with a required
 * query parameter. The same reason as above: without it the request would be
 * answered with 400 before the authentication middleware runs.
 */
const VALID_QUERY_BY_OPERATION: Record<string, string> = {
  "DELETE /chats": "?confirm=true",
  "DELETE /chats/{chatId}/messages": `?fromMessageId=${SOME_UUID}`,
};

const routeHandlers: Record<string, (request: Request) => Promise<Response>> = {
  GET,
  POST,
  PUT,
  PATCH,
  DELETE,
};

/** The level a `security` array stands for; the inverse of `callerAccess`. */
const accessOf = (security: SecurityRequirement[]): CallerAccess => {
  if (security.length === 0) {
    return "none";
  }
  return security.some((requirement) => Object.keys(requirement).length === 0)
    ? "optional"
    : "required";
};

/**
 * What each level must do to a request, written as a total map: a fourth
 * level added to `CallerAccess` does not compile until it is described here.
 */
const EXPECTATIONS: Record<
  CallerAccess,
  { refusesAnonymous: boolean; judgesAuthorizationHeader: boolean }
> = {
  required: { refusesAnonymous: true, judgesAuthorizationHeader: true },
  optional: { refusesAnonymous: false, judgesAuthorizationHeader: true },
  none: { refusesAnonymous: false, judgesAuthorizationHeader: false },
};

const listOperations = (): OperationUnderTest[] => {
  const document = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));

  return Object.entries<
    Record<
      string,
      {
        security: SecurityRequirement[];
        requestBody?: unknown;
        parameters?: { in: string; required?: boolean }[];
      }
    >
  >(document.paths).flatMap(([path, methods]) =>
    Object.entries(methods).map(([method, operation]) => ({
      name: `${method.toUpperCase()} ${path}`,
      method: method.toUpperCase(),
      // A path parameter gets any well-formed value.
      path: path.replace(/\{[^}]+\}/g, SOME_UUID),
      declaredAccess: accessOf(operation.security),
      hasRequestBody: operation.requestBody !== undefined,
      hasRequiredQuery: (operation.parameters ?? []).some(
        (parameter) => parameter.in === "query" && parameter.required === true
      ),
    }))
  );
};

/**
 * A request without a cookie. The CSRF guard applies only to a caller
 * identified by a cookie, so no same-origin header is needed. With
 * `authorization`, the header is sent as given.
 */
const send = (
  operation: OperationUnderTest,
  authorization?: string
): Promise<Response> => {
  const validBody = VALID_BODY_BY_OPERATION[operation.name];
  const query = VALID_QUERY_BY_OPERATION[operation.name] ?? "";
  const headers: Record<string, string> = {
    ...(validBody !== undefined && { "content-type": "application/json" }),
    ...(authorization !== undefined && { authorization }),
  };

  return routeHandlers[operation.method](
    new Request(`${ORIGIN}${PREFIX}${operation.path}${query}`, {
      method: operation.method,
      headers,
      ...(validBody !== undefined && { body: JSON.stringify(validBody) }),
    })
  );
};

/** Status and `data.reason` of an answer, whatever its body is. */
const readAnswer = async (
  response: Response
): Promise<{ status: number; reason: string | undefined }> => {
  const body = (await response.json().catch(() => null)) as ErrorBody;

  return { status: response.status, reason: body?.data?.reason };
};

/**
 * 400 means the body for this operation went stale (validation runs before
 * the middleware, so it would hide a missing check) and 404 that the path no
 * longer routes. Either would make a test below pass for the wrong reason.
 */
const isAnsweredByTheProcedure = (status: number): boolean =>
  status !== 400 && status !== 404;

const operations = listOperations();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCookieSessionUserId).mockResolvedValue(null);
  vi.mocked(resolveBearerSession).mockResolvedValue(null);
});

describe("the declared caller access of each operation", () => {
  it("covers every level, so the walk below is not vacuous", () => {
    // Arrange
    const levels = new Set(
      operations.map(({ declaredAccess }) => declaredAccess)
    );

    // Act / Assert
    expect([...levels].sort()).toEqual(["none", "optional", "required"]);
  });

  it("has a valid body for every operation that takes one", () => {
    // Arrange
    const operationsWithBody = operations.filter(
      ({ hasRequestBody }) => hasRequestBody
    );

    // Act
    const missing = operationsWithBody
      .filter(({ name }) => !(name in VALID_BODY_BY_OPERATION))
      .map(({ name }) => name);
    const unknown = Object.keys(VALID_BODY_BY_OPERATION).filter(
      (name) => !operations.some((operation) => operation.name === name)
    );

    // Assert
    expect({ missing, unknown }).toEqual({ missing: [], unknown: [] });
  });

  it("has a valid query for every operation with a required query parameter", () => {
    // Arrange
    const operationsWithQuery = operations.filter(
      ({ hasRequiredQuery }) => hasRequiredQuery
    );

    // Act
    const missing = operationsWithQuery
      .filter(({ name }) => !(name in VALID_QUERY_BY_OPERATION))
      .map(({ name }) => name);
    const unknown = Object.keys(VALID_QUERY_BY_OPERATION).filter(
      (name) =>
        !operationsWithQuery.some((operation) => operation.name === name)
    );

    // Assert
    expect({ missing, unknown }).toEqual({ missing: [], unknown: [] });
  });

  it.each(operations)(
    "$name: an anonymous caller is refused exactly when it is declared `required`",
    async (operation) => {
      // Arrange
      const { refusesAnonymous } = EXPECTATIONS[operation.declaredAccess];

      // Act
      const { status, reason } = await readAnswer(await send(operation));

      // Assert
      expect(isAnsweredByTheProcedure(status)).toBe(true);
      expect(status === 401 && reason === "not_authenticated").toBe(
        refusesAnonymous
      );
    }
  );

  it.each(operations)(
    "$name: a bad access token is refused exactly when it is not declared `none`",
    async (operation) => {
      // Arrange: `resolveBearerSession` resolves null, so the token is bad.
      const { judgesAuthorizationHeader } =
        EXPECTATIONS[operation.declaredAccess];

      // Act
      const { status, reason } = await readAnswer(
        await send(operation, "Bearer bogus")
      );

      // Assert
      expect(isAnsweredByTheProcedure(status)).toBe(true);
      expect(status === 401 && reason === "invalid_token").toBe(
        judgesAuthorizationHeader
      );
    }
  );
});
