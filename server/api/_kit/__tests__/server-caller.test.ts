import { notFound, redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createServerCaller } from "@/server/api/_kit/server-caller";
import { isSignupEnabled } from "@/server/flags";
import { authenticateCredentials } from "@/server/modules/auth/authenticate-credentials";
import { getCookieSessionUserId } from "@/server/modules/auth/cookie-session";
import { resolveBearerSession } from "@/server/modules/auth/sessions";
import { getMinorUnits } from "@/server/modules/billing/currencies";
import { createProjectForUser } from "@/server/modules/projects/create-project-for-user";
import { deleteProjectForUser } from "@/server/modules/projects/delete-project-for-user";
import { listProjects } from "@/server/modules/projects/list-projects";

// The router, the middlewares and the schemas are real; what reaches outside
// the process is replaced, as in `chats-http.test.ts`. The cookie session is
// the only credential an in-process call may use.
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
vi.mock("@/server/modules/projects/list-projects", () => ({
  listProjects: vi.fn(),
}));
vi.mock("@/server/modules/projects/delete-project-for-user", () => ({
  deleteProjectForUser: vi.fn(),
}));
vi.mock("@/server/modules/projects/create-project-for-user", () => ({
  createProjectForUser: vi.fn(),
}));

const USER_ID = "3f0c1b7e-7c0a-4a52-9d1b-1d2a3b4c5d6e";
const PROJECT_ID = "5a1e0f64-2b7c-4d3e-9a8b-0c1d2e3f4a5b";
const MOMENT = new Date("2026-03-04T05:06:07.123Z");

const projectRow = {
  id: PROJECT_ID,
  userId: USER_ID,
  name: "Work",
  description: null,
  swatch: "sw1",
  contextEntries: [],
  isDefault: false,
  pinned: false,
  usageCount: 0,
  createdAt: MOMENT,
  updatedAt: MOMENT,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockReturnValue();
  vi.mocked(getCookieSessionUserId).mockResolvedValue(null);
  vi.mocked(resolveBearerSession).mockResolvedValue(null);
  vi.mocked(isSignupEnabled).mockResolvedValue(true);
  vi.mocked(getMinorUnits).mockResolvedValue(2);
  vi.mocked(listProjects).mockResolvedValue([projectRow]);
  vi.mocked(createProjectForUser).mockResolvedValue({
    status: "created",
    project: projectRow,
  });
});

describe("createServerCaller on a GET procedure that needs a signed-in user", () => {
  it("runs as the cookie session's user and returns the DTOs", async () => {
    // Arrange
    vi.mocked(getCookieSessionUserId).mockResolvedValue(USER_ID);

    // Act
    const result = await createServerCaller().projects.list();

    // Assert
    expect(listProjects).toHaveBeenCalledExactlyOnceWith({ userId: USER_ID });
    expect(result.items).toEqual([
      {
        id: PROJECT_ID,
        name: "Work",
        description: null,
        swatch: "sw1",
        contextEntries: [],
        isDefault: false,
        pinned: false,
        usageCount: 0,
        createdAt: "2026-03-04T05:06:07.123Z",
        updatedAt: "2026-03-04T05:06:07.123Z",
      },
    ]);
  });

  it("fails an anonymous call as an anonymous HTTP call fails", async () => {
    // Act
    const attempt = createServerCaller().projects.list();

    // Assert
    await expect(attempt).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
      data: { reason: "not_authenticated" },
    });
    expect(listProjects).not.toHaveBeenCalled();
  });
});

describe("createServerCaller is read-only", () => {
  beforeEach(() => {
    vi.mocked(getCookieSessionUserId).mockResolvedValue(USER_ID);
  });

  it("refuses a POST procedure that needs a user, before its service runs", async () => {
    // Act
    const attempt = createServerCaller().projects.create({ name: "Work" });

    // Assert
    await expect(attempt).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
    });
    expect(createProjectForUser).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("[api:v1]"),
      expect.objectContaining({
        message: expect.stringContaining(
          '"projects.create" is a POST procedure'
        ),
      })
    );
  });

  it("refuses a DELETE procedure, before its service runs", async () => {
    // Act
    const attempt = createServerCaller().projects.remove({
      projectId: PROJECT_ID,
    });

    // Assert
    await expect(attempt).rejects.toMatchObject({ status: 500 });
    expect(deleteProjectForUser).not.toHaveBeenCalled();
  });

  it("refuses a POST procedure that reads no credentials", async () => {
    // Act
    const attempt = createServerCaller().auth.login({
      email: "user@example.test",
      password: "Str0ng!Passw0rd",
      client: { platform: "ios" },
    });

    // Assert
    await expect(attempt).rejects.toMatchObject({ status: 500 });
    expect(authenticateCredentials).not.toHaveBeenCalled();
  });

  it("refuses a state-changing call even when anonymous, before auth is judged", async () => {
    // Arrange
    vi.mocked(getCookieSessionUserId).mockResolvedValue(null);

    // Act
    const attempt = createServerCaller().projects.create({ name: "Work" });

    // Assert
    await expect(attempt).rejects.toMatchObject({ status: 500 });
    expect(getCookieSessionUserId).not.toHaveBeenCalled();
  });
});

describe("createServerCaller never takes a bearer token", () => {
  it("does not consult one for an anonymous call", async () => {
    // Arrange
    vi.mocked(resolveBearerSession).mockResolvedValue({
      userId: USER_ID,
      sessionId: "session-1",
    });

    // Act
    const attempt = createServerCaller().projects.list();

    // Assert
    await expect(attempt).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(resolveBearerSession).not.toHaveBeenCalled();
  });
});

describe("createServerCaller on a GET procedure that reads no credentials", () => {
  it("answers a signed-in caller", async () => {
    // Arrange
    vi.mocked(getCookieSessionUserId).mockResolvedValue(USER_ID);

    // Act
    const config = await createServerCaller().config.get();

    // Assert
    expect(config).toMatchObject({ features: { signup: true } });
  });

  it("answers an anonymous caller and reads no cookie", async () => {
    // Act
    const config = await createServerCaller().config.get();

    // Assert
    expect(config).toMatchObject({ features: { signup: true } });
    expect(getCookieSessionUserId).not.toHaveBeenCalled();
  });
});

describe("createServerCaller and Next's control flow", () => {
  it("lets a redirect thrown in a procedure reach Next unchanged", async () => {
    // Arrange
    let thrown: unknown;
    try {
      redirect("/login");
    } catch (error) {
      thrown = error;
    }
    vi.mocked(isSignupEnabled).mockRejectedValue(thrown);

    // Act
    const attempt = createServerCaller().config.get();

    // Assert
    await expect(attempt).rejects.toBe(thrown);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("lets a not-found thrown in a procedure reach Next unchanged", async () => {
    // Arrange
    let thrown: unknown;
    try {
      notFound();
    } catch (error) {
      thrown = error;
    }
    vi.mocked(isSignupEnabled).mockRejectedValue(thrown);

    // Act
    const attempt = createServerCaller().config.get();

    // Assert
    await expect(attempt).rejects.toBe(thrown);
  });

  it("still turns an ordinary error into a 500 without its message", async () => {
    // Arrange
    vi.mocked(isSignupEnabled).mockRejectedValue(new Error("db password"));

    // Act
    const attempt = createServerCaller().config.get();

    // Assert
    await expect(attempt).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error",
    });
  });
});
