import { compare } from "bcrypt-ts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/server/db/schema";
import {
  beginLoginAttempt,
  recordFailedLogin,
  recordSuccessfulLogin,
} from "@/server/http/rate-limit";
import { authenticateCredentials } from "@/server/modules/auth/authenticate-credentials";
import { getUserByEmail } from "@/server/modules/users/queries/get-by-email";

vi.mock("bcrypt-ts", () => ({ compare: vi.fn() }));
vi.mock("@/server/http/rate-limit", () => ({
  beginLoginAttempt: vi.fn(),
  recordFailedLogin: vi.fn(),
  recordSuccessfulLogin: vi.fn(),
}));
vi.mock("@/server/modules/auth/dummy-password", () => ({
  DUMMY_PASSWORD: "dummy-hash",
}));
vi.mock("@/server/modules/users/queries/get-by-email", () => ({
  getUserByEmail: vi.fn(),
}));

const EMAIL = "user@example.test";
const PASSWORD = "typed-password";
const IP = "203.0.113.7";
const IDENTITY = { email: EMAIL, ip: IP };
const THROTTLE_DELAY_MS = 2000;

const storedUser = { id: "user-1", email: EMAIL, password: "stored-hash" };
const asUser = (row: Partial<User>): User => row as User;

const credentials = { email: EMAIL, password: PASSWORD, ip: IP };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(beginLoginAttempt).mockResolvedValue({
    isAllowed: true,
    isUnavailable: false,
    shouldDelay: false,
  });
  vi.mocked(getUserByEmail).mockResolvedValue(asUser(storedUser));
  vi.mocked(compare).mockResolvedValue(true);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("authenticateCredentials", () => {
  it("answers the user and clears the failure count for a correct password", async () => {
    // Act
    const result = await authenticateCredentials(credentials);

    // Assert
    expect(result).toEqual({ status: "authenticated", user: storedUser });
    expect(compare).toHaveBeenCalledWith(PASSWORD, "stored-hash");
    expect(recordSuccessfulLogin).toHaveBeenCalledWith(IDENTITY);
    expect(recordFailedLogin).not.toHaveBeenCalled();
  });

  it("answers invalid_credentials and counts a failure for a wrong password", async () => {
    // Arrange
    vi.mocked(compare).mockResolvedValue(false);

    // Act
    const result = await authenticateCredentials(credentials);

    // Assert
    expect(result).toEqual({ status: "invalid_credentials" });
    expect(recordFailedLogin).toHaveBeenCalledWith(IDENTITY);
    expect(recordSuccessfulLogin).not.toHaveBeenCalled();
  });

  it.each<[string, User | null]>([
    ["an unknown email", null],
    [
      "an account without a password",
      asUser({ ...storedUser, password: null }),
    ],
  ])(
    "spends one comparison against the dummy hash for %s",
    async (_case, userRow) => {
      // Arrange
      vi.mocked(getUserByEmail).mockResolvedValue(userRow);

      // Act
      const result = await authenticateCredentials(credentials);

      // Assert
      expect(result).toEqual({ status: "invalid_credentials" });
      expect(compare).toHaveBeenCalledExactlyOnceWith(PASSWORD, "dummy-hash");
      expect(recordFailedLogin).toHaveBeenCalledWith(IDENTITY);
    }
  );

  it("answers rate_limited without looking the account up when the limit refuses", async () => {
    // Arrange
    vi.mocked(beginLoginAttempt).mockResolvedValue({
      isAllowed: false,
      isUnavailable: false,
      shouldDelay: false,
    });

    // Act
    const result = await authenticateCredentials(credentials);

    // Assert
    expect(result).toEqual({ status: "rate_limited" });
    expect(getUserByEmail).not.toHaveBeenCalled();
    expect(compare).not.toHaveBeenCalled();
  });

  it("holds the answer back for two seconds when the account is under attack", async () => {
    // Arrange
    vi.useFakeTimers();
    vi.mocked(beginLoginAttempt).mockResolvedValue({
      isAllowed: true,
      isUnavailable: false,
      shouldDelay: true,
    });

    // Act
    const pending = authenticateCredentials(credentials);
    await vi.advanceTimersByTimeAsync(THROTTLE_DELAY_MS - 1);
    const lookupsBeforeTheDelayEnds =
      vi.mocked(getUserByEmail).mock.calls.length;
    await vi.advanceTimersByTimeAsync(1);
    const result = await pending;

    // Assert
    expect(lookupsBeforeTheDelayEnds).toBe(0);
    expect(result.status).toBe("authenticated");
  });

  it("passes a missing address on to the limits as null", async () => {
    // Act
    await authenticateCredentials({ ...credentials, ip: null });

    // Assert
    expect(beginLoginAttempt).toHaveBeenCalledWith({ email: EMAIL, ip: null });
  });
});
