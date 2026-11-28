import { beforeEach, describe, expect, it, vi } from "vitest";

import { createHandler } from "@/server/api/_kit/create-handler";
import { v1Router } from "@/server/api/v1/router";
import { getCookieSessionUserId } from "@/server/modules/auth/cookie-session";
import { resolveBearerSession } from "@/server/modules/auth/sessions";
import { createProjectForUser } from "@/server/modules/projects/create-project-for-user";
import { deleteProjectForUser } from "@/server/modules/projects/delete-project-for-user";
import { getProject } from "@/server/modules/projects/get-project";
import { listProjects } from "@/server/modules/projects/list-projects";
import { updateProjectForUser } from "@/server/modules/projects/update-project-for-user";

// The handler, the router, the middlewares, the schemas, the mappers and the
// cursor codec are real. The project services and what reaches outside the
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
vi.mock("@/server/modules/projects/create-project-for-user", () => ({
  createProjectForUser: vi.fn(),
}));
vi.mock("@/server/modules/projects/delete-project-for-user", () => ({
  deleteProjectForUser: vi.fn(),
}));
vi.mock("@/server/modules/projects/get-project", () => ({
  getProject: vi.fn(),
}));
vi.mock("@/server/modules/projects/list-projects", () => ({
  listProjects: vi.fn(),
}));
vi.mock("@/server/modules/projects/update-project-for-user", () => ({
  updateProjectForUser: vi.fn(),
}));

const ORIGIN = "https://gipiti.test";
const PREFIX = "/api/v1";
const USER_ID = "3f0c1b7e-7c0a-4a52-9d1b-1d2a3b4c5d6e";
const SESSION_ID = "9d1b3f0c-1b7e-4a52-8c0a-6e5d4c3b2a1d";
const PROJECT_ID = "5a1e0f64-2b7c-4d3e-9a8b-0c1d2e3f4a5b";
const ACCESS_TOKEN = "header.payload.signature";

const BEARER = { authorization: `Bearer ${ACCESS_TOKEN}` };
const SAME_ORIGIN = { "sec-fetch-site": "same-origin" };

const CREATED_AT = new Date("2026-03-04T05:06:07.123Z");
const UPDATED_AT = new Date("2026-03-05T06:07:08.456Z");

const makeProjectRow = (overrides: Record<string, unknown> = {}) => ({
  id: PROJECT_ID,
  userId: USER_ID,
  name: "Work",
  description: "Notes for work",
  swatch: "sw2",
  contextEntries: ["Answer briefly."],
  isDefault: false,
  pinned: true,
  usageCount: 3,
  createdAt: CREATED_AT,
  updatedAt: UPDATED_AT,
  ...overrides,
});

const PROJECT_DTO = {
  id: PROJECT_ID,
  name: "Work",
  description: "Notes for work",
  swatch: "sw2",
  contextEntries: ["Answer briefly."],
  isDefault: false,
  pinned: true,
  usageCount: 3,
  createdAt: "2026-03-04T05:06:07.123Z",
  updatedAt: "2026-03-05T06:07:08.456Z",
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
  method: "GET" | "POST" | "PATCH" | "DELETE",
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
  vi.mocked(listProjects).mockResolvedValue([makeProjectRow()]);
  vi.mocked(createProjectForUser).mockResolvedValue({
    status: "created",
    project: makeProjectRow(),
  });
  vi.mocked(getProject).mockResolvedValue({
    status: "ok",
    project: makeProjectRow(),
  });
  vi.mocked(updateProjectForUser).mockResolvedValue({
    status: "ok",
    project: makeProjectRow(),
  });
  vi.mocked(deleteProjectForUser).mockResolvedValue({ status: "deleted" });
});

describe("GET /projects", () => {
  it("lists the caller's projects without the owner", async () => {
    // Act
    const response = await call("GET", "/projects", { headers: BEARER });

    // Assert
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [PROJECT_DTO] });
    expect(listProjects).toHaveBeenCalledExactlyOnceWith({ userId: USER_ID });
  });

  it("answers an empty list when there are no projects", async () => {
    // Arrange
    vi.mocked(listProjects).mockResolvedValue([]);

    // Act
    const response = await call("GET", "/projects", { headers: BEARER });

    // Assert
    expect(await response.json()).toEqual({ items: [] });
  });

  it("returns a stored swatch outside the known set as it is", async () => {
    // Arrange
    vi.mocked(listProjects).mockResolvedValue([
      makeProjectRow({ swatch: "sw9" }),
      makeProjectRow({ swatch: null, description: null }),
    ]);

    // Act
    const response = await call("GET", "/projects", { headers: BEARER });

    // Assert
    const body = (await response.json()) as {
      items: { swatch: string | null }[];
    };
    expect(response.status).toBe(200);
    expect(body.items.map(({ swatch }) => swatch)).toEqual(["sw9", null]);
  });

  it("serves a browser session", async () => {
    // Arrange
    vi.mocked(getCookieSessionUserId).mockResolvedValue(USER_ID);

    // Act
    const response = await call("GET", "/projects");

    // Assert
    expect(response.status).toBe(200);
  });

  it("answers 401 to an anonymous caller", async () => {
    // Act
    const response = await call("GET", "/projects");

    // Assert
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject(NOT_AUTHENTICATED);
    expect(listProjects).not.toHaveBeenCalled();
  });
});

describe("POST /projects", () => {
  it("creates a project and answers 201 with it", async () => {
    // Arrange
    const body = {
      name: "Work",
      description: "Notes for work",
      swatch: "sw2",
      contextEntries: ["Answer briefly."],
      isDefault: true,
    };

    // Act
    const response = await call("POST", "/projects", {
      headers: BEARER,
      body,
    });

    // Assert
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(PROJECT_DTO);
    expect(createProjectForUser).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID,
      ...body,
    });
  });

  it("needs only a name", async () => {
    // Act
    const response = await call("POST", "/projects", {
      headers: BEARER,
      body: { name: "Work" },
    });

    // Assert
    expect(response.status).toBe(201);
    expect(createProjectForUser).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID,
      name: "Work",
    });
  });

  it("answers 409 project_limit_reached with the limit", async () => {
    // Arrange
    vi.mocked(createProjectForUser).mockResolvedValue({
      status: "project_limit_reached",
      limit: 100,
    });

    // Act
    const response = await call("POST", "/projects", {
      headers: BEARER,
      body: { name: "Work" },
    });

    // Assert
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      defined: true,
      code: "CONFLICT",
      status: 409,
      data: { reason: "project_limit_reached", limit: 100 },
    });
  });

  it("accepts null for the description and the swatch", async () => {
    // Act
    const response = await call("POST", "/projects", {
      headers: BEARER,
      body: { name: "Work", description: null, swatch: null },
    });

    // Assert
    expect(response.status).toBe(201);
  });

  it("accepts the limits of every field", async () => {
    // Act
    const response = await call("POST", "/projects", {
      headers: BEARER,
      body: {
        name: "n".repeat(128),
        description: "d".repeat(280),
        contextEntries: Array.from({ length: 20 }, () => "e".repeat(2000)),
      },
    });

    // Assert
    expect(response.status).toBe(201);
  });

  it("ignores fields it does not know, `pinned` included", async () => {
    // Act
    const response = await call("POST", "/projects", {
      headers: BEARER,
      body: { name: "Work", pinned: true, userId: "someone-else" },
    });

    // Assert
    expect(response.status).toBe(201);
    expect(createProjectForUser).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID,
      name: "Work",
    });
  });

  it.each([
    ["no name", {}],
    ["an empty name", { name: "" }],
    ["a name of 129 characters", { name: "n".repeat(129) }],
    ["a name that is not text", { name: 5 }],
    [
      "a description of 281 characters",
      { name: "a", description: "d".repeat(281) },
    ],
    ["a swatch outside the set", { name: "a", swatch: "sw7" }],
    [
      "21 context entries",
      { name: "a", contextEntries: new Array(21).fill("e") },
    ],
    ["an empty context entry", { name: "a", contextEntries: [""] }],
    [
      "a context entry of 2001 characters",
      { name: "a", contextEntries: ["e".repeat(2001)] },
    ],
    ["context entries that are not a list", { name: "a", contextEntries: "e" }],
    ["a non-boolean isDefault", { name: "a", isDefault: "yes" }],
    ["a NUL character in the name", { name: "a\u0000b" }],
    [
      "a NUL character in the description",
      { name: "a", description: "\u0000" },
    ],
    [
      "a NUL character in a context entry",
      { name: "a", contextEntries: ["x\u0000"] },
    ],
  ])("answers 400 for %s", async (_label, body) => {
    // Act
    const response = await call("POST", "/projects", {
      headers: BEARER,
      body,
    });

    // Assert
    expect(response.status).toBe(400);
    expect(createProjectForUser).not.toHaveBeenCalled();
  });

  it("answers 401 to an anonymous caller", async () => {
    // Act
    const response = await call("POST", "/projects", {
      body: { name: "Work" },
    });

    // Assert
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject(NOT_AUTHENTICATED);
    expect(createProjectForUser).not.toHaveBeenCalled();
  });

  it("answers 403 to a browser session without a same-origin proof", async () => {
    // Arrange
    vi.mocked(getCookieSessionUserId).mockResolvedValue(USER_ID);

    // Act
    const response = await call("POST", "/projects", {
      body: { name: "Work" },
    });

    // Assert
    expect(response.status).toBe(403);
    expect(createProjectForUser).not.toHaveBeenCalled();
  });

  it("serves a browser session that shows a same-origin proof", async () => {
    // Arrange
    vi.mocked(getCookieSessionUserId).mockResolvedValue(USER_ID);

    // Act
    const response = await call("POST", "/projects", {
      headers: SAME_ORIGIN,
      body: { name: "Work" },
    });

    // Assert
    expect(response.status).toBe(201);
  });
});

describe("GET /projects/{projectId}", () => {
  it("answers the project", async () => {
    // Act
    const response = await call("GET", `/projects/${PROJECT_ID}`, {
      headers: BEARER,
    });

    // Assert
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(PROJECT_DTO);
    expect(getProject).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID,
      projectId: PROJECT_ID,
    });
  });

  it("answers 404 for a missing or foreign project", async () => {
    // Arrange
    vi.mocked(getProject).mockResolvedValue({ status: "project_not_found" });

    // Act
    const response = await call("GET", `/projects/${PROJECT_ID}`, {
      headers: BEARER,
    });

    // Assert
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      defined: true,
      code: "NOT_FOUND",
    });
  });

  it("answers 400 for an id that is not a uuid", async () => {
    // Act
    const response = await call("GET", "/projects/not-a-uuid", {
      headers: BEARER,
    });

    // Assert
    expect(response.status).toBe(400);
    expect(getProject).not.toHaveBeenCalled();
  });

  it("answers 401 to an anonymous caller", async () => {
    // Act
    const response = await call("GET", `/projects/${PROJECT_ID}`);

    // Assert
    expect(response.status).toBe(401);
    expect(getProject).not.toHaveBeenCalled();
  });
});

describe("PATCH /projects/{projectId}", () => {
  it("passes only the fields that are present", async () => {
    // Act
    const response = await call("PATCH", `/projects/${PROJECT_ID}`, {
      headers: BEARER,
      body: { name: "Renamed", pinned: false, isDefault: true },
    });

    // Assert
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(PROJECT_DTO);
    expect(updateProjectForUser).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID,
      projectId: PROJECT_ID,
      changes: { name: "Renamed", pinned: false, isDefault: true },
    });
  });

  it("passes null through, to clear the description and the swatch", async () => {
    // Act
    const response = await call("PATCH", `/projects/${PROJECT_ID}`, {
      headers: BEARER,
      body: { description: null, swatch: null },
    });

    // Assert
    expect(response.status).toBe(200);
    expect(updateProjectForUser).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID,
      projectId: PROJECT_ID,
      changes: { description: null, swatch: null },
    });
  });

  it("takes an empty body", async () => {
    // Act
    const response = await call("PATCH", `/projects/${PROJECT_ID}`, {
      headers: BEARER,
      body: {},
    });

    // Assert
    expect(response.status).toBe(200);
    expect(updateProjectForUser).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID,
      projectId: PROJECT_ID,
      changes: {},
    });
  });

  it("answers 404 for a missing or foreign project", async () => {
    // Arrange
    vi.mocked(updateProjectForUser).mockResolvedValue({
      status: "project_not_found",
    });

    // Act
    const response = await call("PATCH", `/projects/${PROJECT_ID}`, {
      headers: BEARER,
      body: { name: "Renamed" },
    });

    // Assert
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "NOT_FOUND" });
  });

  it.each([
    ["an empty name", { name: "" }],
    ["a name of 129 characters", { name: "n".repeat(129) }],
    ["a description of 281 characters", { description: "d".repeat(281) }],
    ["a swatch outside the set", { swatch: "sw7" }],
    ["21 context entries", { contextEntries: new Array(21).fill("e") }],
    ["an empty context entry", { contextEntries: [""] }],
    [
      "a context entry of 2001 characters",
      { contextEntries: ["e".repeat(2001)] },
    ],
    ["a non-boolean isDefault", { isDefault: 1 }],
    ["a NUL character in the name", { name: "a\u0000b" }],
    ["a non-boolean pinned", { pinned: "true" }],
  ])("answers 400 for %s", async (_label, body) => {
    // Act
    const response = await call("PATCH", `/projects/${PROJECT_ID}`, {
      headers: BEARER,
      body,
    });

    // Assert
    expect(response.status).toBe(400);
    expect(updateProjectForUser).not.toHaveBeenCalled();
  });

  it("answers 400 for an id that is not a uuid", async () => {
    // Act
    const response = await call("PATCH", "/projects/nope", {
      headers: BEARER,
      body: {},
    });

    // Assert
    expect(response.status).toBe(400);
  });

  it("answers 401 to an anonymous caller", async () => {
    // Act
    const response = await call("PATCH", `/projects/${PROJECT_ID}`, {
      body: {},
    });

    // Assert
    expect(response.status).toBe(401);
    expect(updateProjectForUser).not.toHaveBeenCalled();
  });

  it("answers 403 to a browser session without a same-origin proof", async () => {
    // Arrange
    vi.mocked(getCookieSessionUserId).mockResolvedValue(USER_ID);

    // Act
    const response = await call("PATCH", `/projects/${PROJECT_ID}`, {
      body: { name: "Renamed" },
    });

    // Assert
    expect(response.status).toBe(403);
    expect(updateProjectForUser).not.toHaveBeenCalled();
  });
});

describe("DELETE /projects/{projectId}", () => {
  it("answers 204 with no body", async () => {
    // Act
    const response = await call("DELETE", `/projects/${PROJECT_ID}`, {
      headers: BEARER,
    });

    // Assert
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(deleteProjectForUser).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID,
      projectId: PROJECT_ID,
    });
  });

  it("answers 404 for a missing or foreign project", async () => {
    // Arrange
    vi.mocked(deleteProjectForUser).mockResolvedValue({
      status: "project_not_found",
    });

    // Act
    const response = await call("DELETE", `/projects/${PROJECT_ID}`, {
      headers: BEARER,
    });

    // Assert
    expect(response.status).toBe(404);
    expect(((await response.json()) as ErrorBody).code).toBe("NOT_FOUND");
  });

  it("answers 400 for an id that is not a uuid", async () => {
    // Act
    const response = await call("DELETE", "/projects/nope", {
      headers: BEARER,
    });

    // Assert
    expect(response.status).toBe(400);
    expect(deleteProjectForUser).not.toHaveBeenCalled();
  });

  it("answers 401 to an anonymous caller", async () => {
    // Act
    const response = await call("DELETE", `/projects/${PROJECT_ID}`);

    // Assert
    expect(response.status).toBe(401);
    expect(deleteProjectForUser).not.toHaveBeenCalled();
  });

  it("answers 403 to a browser session without a same-origin proof", async () => {
    // Arrange
    vi.mocked(getCookieSessionUserId).mockResolvedValue(USER_ID);

    // Act
    const response = await call("DELETE", `/projects/${PROJECT_ID}`);

    // Assert
    expect(response.status).toBe(403);
    expect(deleteProjectForUser).not.toHaveBeenCalled();
  });
});
