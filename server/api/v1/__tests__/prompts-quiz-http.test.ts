import { beforeEach, describe, expect, it, vi } from "vitest";

import { PROMPT_CATEGORIES } from "@/lib/prompts/prompt-meta";
import { createHandler } from "@/server/api/_kit/create-handler";
import { KNOWN_PROMPT_CATEGORIES } from "@/server/api/v1/_schemas/prompt";
import { v1Router } from "@/server/api/v1/router";
import type { Prompt } from "@/server/db/schema";
import { getCookieSessionUserId } from "@/server/modules/auth/cookie-session";
import { resolveBearerSession } from "@/server/modules/auth/sessions";
import { addPromptFavorite } from "@/server/modules/prompts/queries/add-prompt-favorite";
import { getActiveFavoritePromptIds } from "@/server/modules/prompts/queries/get-active-favorite-prompt-ids";
import { getActivePrompts } from "@/server/modules/prompts/queries/get-active-prompts";
import { isActivePrompt } from "@/server/modules/prompts/queries/is-active-prompt";
import { removePromptFavorite } from "@/server/modules/prompts/queries/remove-prompt-favorite";
import { getQuizCompletion } from "@/server/modules/quiz/get-quiz-completion";
import { submitQuiz } from "@/server/modules/quiz/submit-quiz";

// The handler, the router, the middlewares, the schemas and the mappers are
// real. The prompt queries, the quiz services and what reaches outside the
// process are replaced, as in `account-http.test.ts`.
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
vi.mock("@/server/modules/prompts/queries/add-prompt-favorite", () => ({
  addPromptFavorite: vi.fn(),
}));
vi.mock("@/server/modules/prompts/queries/get-active-prompts", () => ({
  getActivePrompts: vi.fn(),
}));
vi.mock(
  "@/server/modules/prompts/queries/get-active-favorite-prompt-ids",
  () => ({
    getActiveFavoritePromptIds: vi.fn(),
  })
);
vi.mock("@/server/modules/prompts/queries/is-active-prompt", () => ({
  isActivePrompt: vi.fn(),
}));
vi.mock("@/server/modules/prompts/queries/remove-prompt-favorite", () => ({
  removePromptFavorite: vi.fn(),
}));
vi.mock("@/server/modules/quiz/get-quiz-completion", () => ({
  getQuizCompletion: vi.fn(),
}));
vi.mock("@/server/modules/quiz/submit-quiz", () => ({
  submitQuiz: vi.fn(),
}));

const ORIGIN = "https://gipiti.test";
const PREFIX = "/api/v1";
const USER_ID = "3f0c1b7e-7c0a-4a52-9d1b-1d2a3b4c5d6e";
const SESSION_ID = "9d1b3f0c-1b7e-4a52-8c0a-6e5d4c3b2a1d";
const PROMPT_ID = "5a1e0f64-2b7c-4d3e-9a8b-0c1d2e3f4a5b";
const OTHER_PROMPT_ID = "8c2d4e6f-1a3b-4c5d-8e7f-9a0b1c2d3e4f";
const ACCESS_TOKEN = "header.payload.signature";
const QUIZ_KEY = "onboarding";
const ANSWERS = { sphere: "it", level: 3 };

const BEARER = { authorization: `Bearer ${ACCESS_TOKEN}` };
const STALE_BEARER = { authorization: "Bearer stale.token.value" };
const SAME_ORIGIN = { "sec-fetch-site": "same-origin" };

const PROMPT_ROW: Prompt = {
  id: PROMPT_ID,
  key: "t1",
  category: "text",
  modelId: "openai/gpt-5",
  title: "Rewrite a text",
  body: "Rewrite the text below in a friendlier tone.",
  tags: ["editing", "tone"],
  sortOrder: 10,
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

type ErrorBody = {
  defined: boolean;
  code: string;
  status: number;
  data?: { reason?: string };
};

const handlers = createHandler(v1Router, { prefix: PREFIX });

type CallInit = { headers?: Record<string, string>; body?: unknown };

const call = (
  method: "GET" | "PUT" | "DELETE",
  path: string,
  { headers = {}, body }: CallInit = {}
): Promise<Response> =>
  handlers[method](
    new Request(`${ORIGIN}${PREFIX}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  );

const useBrowserSession = (): void => {
  vi.mocked(getCookieSessionUserId).mockResolvedValue(USER_ID);
};

/** The body of a 401 for a caller that sent no credentials. */
const NOT_AUTHENTICATED = {
  code: "UNAUTHORIZED",
  data: { reason: "not_authenticated" },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCookieSessionUserId).mockResolvedValue(null);
  vi.mocked(resolveBearerSession).mockImplementation(async (token) =>
    token === ACCESS_TOKEN ? { userId: USER_ID, sessionId: SESSION_ID } : null
  );
  vi.mocked(getActivePrompts).mockResolvedValue([PROMPT_ROW]);
  vi.mocked(getActiveFavoritePromptIds).mockResolvedValue([PROMPT_ID]);
  vi.mocked(isActivePrompt).mockResolvedValue(true);
  vi.mocked(getQuizCompletion).mockResolvedValue({
    status: "ok",
    isCompleted: false,
  });
  vi.mocked(submitQuiz).mockResolvedValue({
    status: "completed",
    isBonusGranted: true,
    bonus: { amountMinor: 5000, currencyCode: "RUB" },
  });
});

describe("the prompt categories", () => {
  it("are the ones the web knows", () => {
    // Arrange
    const webCategoryIds = PROMPT_CATEGORIES.map((category) => category.id);

    // Act / Assert
    expect([...KNOWN_PROMPT_CATEGORIES]).toEqual(webCategoryIds);
  });
});

describe("GET /prompts", () => {
  it("lists the active prompts without database internals", async () => {
    // Act
    const response = await call("GET", "/prompts");

    // Assert
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [
        {
          id: PROMPT_ID,
          key: "t1",
          category: "text",
          modelId: "openai/gpt-5",
          title: "Rewrite a text",
          body: "Rewrite the text below in a friendlier tone.",
          tags: ["editing", "tone"],
        },
      ],
    });
  });

  it("answers an empty catalogue with an empty list", async () => {
    // Arrange
    vi.mocked(getActivePrompts).mockResolvedValue([]);

    // Act
    const response = await call("GET", "/prompts");

    // Assert
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [] });
  });

  it("answers an anonymous caller and reads no credentials", async () => {
    // Act
    const response = await call("GET", "/prompts");

    // Assert
    expect(response.status).toBe(200);
    expect(getCookieSessionUserId).not.toHaveBeenCalled();
    expect(resolveBearerSession).not.toHaveBeenCalled();
  });

  it("answers 200 to a caller with a stale access token", async () => {
    // Act
    const response = await call("GET", "/prompts", { headers: STALE_BEARER });

    // Assert
    expect(response.status).toBe(200);
    expect(resolveBearerSession).not.toHaveBeenCalled();
  });
});

describe("GET /me/favorite-prompts", () => {
  it("lists the ids of the caller's favourites", async () => {
    // Arrange
    vi.mocked(getActiveFavoritePromptIds).mockResolvedValue([
      PROMPT_ID,
      OTHER_PROMPT_ID,
    ]);

    // Act
    const response = await call("GET", "/me/favorite-prompts", {
      headers: BEARER,
    });

    // Assert
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [{ promptId: PROMPT_ID }, { promptId: OTHER_PROMPT_ID }],
    });
    expect(getActiveFavoritePromptIds).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID,
    });
  });

  it("answers an empty list when there are no favourites", async () => {
    // Arrange
    vi.mocked(getActiveFavoritePromptIds).mockResolvedValue([]);

    // Act
    const response = await call("GET", "/me/favorite-prompts", {
      headers: BEARER,
    });

    // Assert
    expect(await response.json()).toEqual({ items: [] });
  });

  it("serves a browser session", async () => {
    // Arrange
    useBrowserSession();

    // Act
    const response = await call("GET", "/me/favorite-prompts");

    // Assert
    expect(response.status).toBe(200);
  });

  it("refuses an anonymous caller with 401 not_authenticated", async () => {
    // Act
    const response = await call("GET", "/me/favorite-prompts");

    // Assert
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject(NOT_AUTHENTICATED);
    expect(getActiveFavoritePromptIds).not.toHaveBeenCalled();
  });
});

describe("PUT /me/favorite-prompts/{promptId}", () => {
  it("stars the prompt and answers 204", async () => {
    // Act
    const response = await call("PUT", `/me/favorite-prompts/${PROMPT_ID}`, {
      headers: BEARER,
    });

    // Assert
    expect(response.status).toBe(204);
    expect(addPromptFavorite).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID,
      promptId: PROMPT_ID,
    });
  });

  it("answers 204 again when the prompt is already a favourite", async () => {
    // Act
    const first = await call("PUT", `/me/favorite-prompts/${PROMPT_ID}`, {
      headers: BEARER,
    });
    const second = await call("PUT", `/me/favorite-prompts/${PROMPT_ID}`, {
      headers: BEARER,
    });

    // Assert
    expect([first.status, second.status]).toEqual([204, 204]);
  });

  it("answers 404 for a prompt that is not on offer (unknown or switched off) and stars nothing", async () => {
    // Arrange
    vi.mocked(isActivePrompt).mockResolvedValue(false);

    // Act
    const response = await call("PUT", `/me/favorite-prompts/${PROMPT_ID}`, {
      headers: BEARER,
    });

    // Assert
    expect(response.status).toBe(404);
    expect(((await response.json()) as ErrorBody).code).toBe("NOT_FOUND");
    expect(addPromptFavorite).not.toHaveBeenCalled();
  });

  it("refuses an id that is not a UUID with 400", async () => {
    // Act
    const response = await call("PUT", "/me/favorite-prompts/not-a-uuid", {
      headers: BEARER,
    });

    // Assert
    expect(response.status).toBe(400);
    expect(isActivePrompt).not.toHaveBeenCalled();
  });

  it("refuses an anonymous caller with 401 not_authenticated", async () => {
    // Act
    const response = await call("PUT", `/me/favorite-prompts/${PROMPT_ID}`);

    // Assert
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject(NOT_AUTHENTICATED);
    expect(addPromptFavorite).not.toHaveBeenCalled();
  });

  it("refuses a browser session without same-origin proof with 403", async () => {
    // Arrange
    useBrowserSession();

    // Act
    const response = await call("PUT", `/me/favorite-prompts/${PROMPT_ID}`);

    // Assert
    expect(response.status).toBe(403);
    expect(((await response.json()) as ErrorBody).data?.reason).toBe(
      "cross_site_request"
    );
    expect(addPromptFavorite).not.toHaveBeenCalled();
  });

  it("serves a browser session that comes from a page of this site", async () => {
    // Arrange
    useBrowserSession();

    // Act
    const response = await call("PUT", `/me/favorite-prompts/${PROMPT_ID}`, {
      headers: SAME_ORIGIN,
    });

    // Assert
    expect(response.status).toBe(204);
  });
});

describe("DELETE /me/favorite-prompts/{promptId}", () => {
  it("unstars the prompt and answers 204", async () => {
    // Act
    const response = await call("DELETE", `/me/favorite-prompts/${PROMPT_ID}`, {
      headers: BEARER,
    });

    // Assert
    expect(response.status).toBe(204);
    expect(removePromptFavorite).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID,
      promptId: PROMPT_ID,
    });
  });

  it("answers 204 again when the prompt is not a favourite", async () => {
    // Act
    const first = await call("DELETE", `/me/favorite-prompts/${PROMPT_ID}`, {
      headers: BEARER,
    });
    const second = await call("DELETE", `/me/favorite-prompts/${PROMPT_ID}`, {
      headers: BEARER,
    });

    // Assert
    expect([first.status, second.status]).toEqual([204, 204]);
  });

  it("refuses an id that is not a UUID with 400", async () => {
    // Act
    const response = await call("DELETE", "/me/favorite-prompts/42", {
      headers: BEARER,
    });

    // Assert
    expect(response.status).toBe(400);
    expect(removePromptFavorite).not.toHaveBeenCalled();
  });

  it("refuses an anonymous caller with 401 not_authenticated", async () => {
    // Act
    const response = await call("DELETE", `/me/favorite-prompts/${PROMPT_ID}`);

    // Assert
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject(NOT_AUTHENTICATED);
    expect(removePromptFavorite).not.toHaveBeenCalled();
  });

  it("refuses a browser session without same-origin proof with 403", async () => {
    // Arrange
    useBrowserSession();

    // Act
    const response = await call("DELETE", `/me/favorite-prompts/${PROMPT_ID}`);

    // Assert
    expect(response.status).toBe(403);
    expect(((await response.json()) as ErrorBody).data?.reason).toBe(
      "cross_site_request"
    );
    expect(removePromptFavorite).not.toHaveBeenCalled();
  });
});

describe("GET /me/quizzes/{quizKey}", () => {
  it("answers whether the quiz is completed", async () => {
    // Arrange
    vi.mocked(getQuizCompletion).mockResolvedValue({
      status: "ok",
      isCompleted: true,
    });

    // Act
    const response = await call("GET", `/me/quizzes/${QUIZ_KEY}`, {
      headers: BEARER,
    });

    // Assert
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ completed: true });
    expect(getQuizCompletion).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID,
      quizKey: QUIZ_KEY,
    });
  });

  it("answers completed false for a quiz not yet taken", async () => {
    // Act
    const response = await call("GET", `/me/quizzes/${QUIZ_KEY}`, {
      headers: BEARER,
    });

    // Assert
    expect(await response.json()).toEqual({ completed: false });
  });

  it("answers 404 for a quiz that does not exist", async () => {
    // Arrange
    vi.mocked(getQuizCompletion).mockResolvedValue({ status: "unknown_quiz" });

    // Act
    const response = await call("GET", "/me/quizzes/nope", { headers: BEARER });

    // Assert
    expect(response.status).toBe(404);
    expect(((await response.json()) as ErrorBody).code).toBe("NOT_FOUND");
  });

  it.each(["constructor", "toString"])(
    "answers 404 for the quiz key %s, a name on Object.prototype",
    async (quizKey) => {
      // Arrange
      vi.mocked(getQuizCompletion).mockResolvedValue({
        status: "unknown_quiz",
      });

      // Act
      const response = await call("GET", `/me/quizzes/${quizKey}`, {
        headers: BEARER,
      });

      // Assert
      expect(response.status).toBe(404);
    }
  );

  it("refuses an anonymous caller with 401 not_authenticated", async () => {
    // Act
    const response = await call("GET", `/me/quizzes/${QUIZ_KEY}`);

    // Assert
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject(NOT_AUTHENTICATED);
    expect(getQuizCompletion).not.toHaveBeenCalled();
  });
});

describe("PUT /me/quizzes/{quizKey}", () => {
  it("saves the answers and reports the bonus this call credited", async () => {
    // Act
    const response = await call("PUT", `/me/quizzes/${QUIZ_KEY}`, {
      headers: BEARER,
      body: { answers: ANSWERS },
    });

    // Assert
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      completed: true,
      bonusGranted: true,
      bonus: { amountMinor: 5000, currencyCode: "RUB" },
    });
    expect(submitQuiz).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID,
      quizKey: QUIZ_KEY,
      answers: ANSWERS,
    });
  });

  it("answers completed with no bonus on a repeat", async () => {
    // Arrange
    vi.mocked(submitQuiz).mockResolvedValue({
      status: "completed",
      isBonusGranted: false,
      bonus: null,
    });

    // Act
    const response = await call("PUT", `/me/quizzes/${QUIZ_KEY}`, {
      headers: BEARER,
      body: { answers: ANSWERS },
    });

    // Assert
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      completed: true,
      bonusGranted: false,
      bonus: null,
    });
  });

  it("answers 404 for a quiz that does not exist", async () => {
    // Arrange
    vi.mocked(submitQuiz).mockResolvedValue({ status: "unknown_quiz" });

    // Act
    const response = await call("PUT", "/me/quizzes/nope", {
      headers: BEARER,
      body: { answers: ANSWERS },
    });

    // Assert
    expect(response.status).toBe(404);
    expect(((await response.json()) as ErrorBody).code).toBe("NOT_FOUND");
  });

  it("answers 400 invalid_answers without the quiz's own validation issues", async () => {
    // Arrange
    vi.mocked(submitQuiz).mockResolvedValue({ status: "invalid_answers" });

    // Act
    const response = await call("PUT", `/me/quizzes/${QUIZ_KEY}`, {
      headers: BEARER,
      body: { answers: { sphere: "nonsense" } },
    });

    // Assert
    const body = (await response.json()) as ErrorBody;
    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      defined: true,
      code: "BAD_REQUEST",
      status: 400,
    });
    // Only the reason: the quiz's own validation issues stay on the server.
    expect(body.data).toEqual({ reason: "invalid_answers" });
  });

  it("answers 403 email_not_verified", async () => {
    // Arrange
    vi.mocked(submitQuiz).mockResolvedValue({ status: "email_not_verified" });

    // Act
    const response = await call("PUT", `/me/quizzes/${QUIZ_KEY}`, {
      headers: BEARER,
      body: { answers: ANSWERS },
    });

    // Assert
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      defined: true,
      code: "FORBIDDEN",
      data: { reason: "email_not_verified" },
    });
  });

  it.each([
    ["an array", { answers: [1, 2] }],
    ["a string", { answers: "it" }],
    ["nothing", {}],
  ])("refuses answers that are %s with a plain 400", async (_label, body) => {
    // Act
    const response = await call("PUT", `/me/quizzes/${QUIZ_KEY}`, {
      headers: BEARER,
      body,
    });

    // Assert
    expect(response.status).toBe(400);
    expect(submitQuiz).not.toHaveBeenCalled();
  });

  it("refuses an empty quiz key with 404, as the path does not route", async () => {
    // Act
    const response = await call("PUT", "/me/quizzes/", {
      headers: BEARER,
      body: { answers: ANSWERS },
    });

    // Assert
    expect(response.status).toBe(404);
    expect(submitQuiz).not.toHaveBeenCalled();
  });

  it("refuses a quiz key longer than 64 characters with 400", async () => {
    // Act
    const response = await call("PUT", `/me/quizzes/${"k".repeat(65)}`, {
      headers: BEARER,
      body: { answers: ANSWERS },
    });

    // Assert
    expect(response.status).toBe(400);
    expect(submitQuiz).not.toHaveBeenCalled();
  });

  it("refuses an anonymous caller with 401 not_authenticated", async () => {
    // Act
    const response = await call("PUT", `/me/quizzes/${QUIZ_KEY}`, {
      body: { answers: ANSWERS },
    });

    // Assert
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject(NOT_AUTHENTICATED);
    expect(submitQuiz).not.toHaveBeenCalled();
  });

  it("refuses a browser session without same-origin proof with 403 cross_site_request", async () => {
    // Arrange
    useBrowserSession();

    // Act
    const response = await call("PUT", `/me/quizzes/${QUIZ_KEY}`, {
      body: { answers: ANSWERS },
    });

    // Assert
    expect(response.status).toBe(403);
    expect(((await response.json()) as ErrorBody).data?.reason).toBe(
      "cross_site_request"
    );
    expect(submitQuiz).not.toHaveBeenCalled();
  });

  it.each(["constructor", "toString", "__proto__"])(
    "answers 404 for the quiz key %s, a name on Object.prototype",
    async (quizKey) => {
      // Arrange
      vi.mocked(submitQuiz).mockResolvedValue({ status: "unknown_quiz" });

      // Act
      const response = await call("PUT", `/me/quizzes/${quizKey}`, {
        headers: BEARER,
        body: { answers: ANSWERS },
      });

      // Assert
      expect(response.status).toBe(404);
    }
  );

  it("serves a browser session that comes from a page of this site", async () => {
    // Arrange
    useBrowserSession();

    // Act
    const response = await call("PUT", `/me/quizzes/${QUIZ_KEY}`, {
      headers: SAME_ORIGIN,
      body: { answers: ANSWERS },
    });

    // Assert
    expect(response.status).toBe(200);
  });
});
