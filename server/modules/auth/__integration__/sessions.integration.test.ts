import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db/connection";
import { authSession, refreshToken, user } from "@/server/db/schema";
import { deleteDeadAuthRecords } from "@/server/modules/auth/queries/auth-sessions";
import { hashToken } from "@/server/modules/auth/reset-token";
import {
  endAllSessions,
  endSession,
  endSessionById,
  issueTokenPair,
  listSessions,
  refreshTokenPair,
  resolveBearerSession,
  type TokenPair,
} from "@/server/modules/auth/sessions";
import { getUserTokenVersion } from "@/server/modules/users/queries/get-token-version";
import { updateUserPassword } from "@/server/modules/users/queries/update-user-password";
import {
  closeDatabaseConnection,
  resetMoneyTables,
} from "@/tests/integration/helpers";

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const DAY_MS = 24 * 60 * MINUTE_MS;

const REFRESH_TTL_DAYS = 60;
const SESSION_TTL_DAYS = 180;
const GRACE_SECONDS = 30;
const PARALLEL_REFRESHES = 5;
/** One rotation and two siblings: what one refresh token can produce. */
const MAX_PAIRS_FROM_ONE_TOKEN = 3;

const CLIENT = {
  platform: "ios",
  deviceName: "Test iPhone",
  appVersion: "1.2.3",
};
const CLIENT_IP = "203.0.113.7";

const timeAfter = (start: Date, milliseconds: number): Date =>
  new Date(start.getTime() + milliseconds);

const seedUser = async (): Promise<string> => {
  const [created] = await db
    .insert(user)
    .values({ email: `session-${randomUUID()}@example.test` })
    .returning({ id: user.id });

  return created.id;
};

const signIn = async (userId: string, now = new Date()): Promise<TokenPair> => {
  const tokens = await issueTokenPair({
    userId,
    client: CLIENT,
    ip: CLIENT_IP,
    now,
  });
  if (!tokens) {
    throw new Error("the seeded account was not found");
  }
  return tokens;
};

/** A refresh that must succeed; the test fails with the status otherwise. */
const refresh = async (token: string, now = new Date()): Promise<TokenPair> => {
  const result = await refreshTokenPair({ refreshToken: token, now });
  if (result.status !== "refreshed") {
    throw new Error(`expected a new pair, got ${result.status}`);
  }
  return result.tokens;
};

const refreshStatus = async (
  token: string,
  now = new Date()
): Promise<string> =>
  (await refreshTokenPair({ refreshToken: token, now })).status;

const readSessionOf = async (tokens: TokenPair) => {
  const bearer = await resolveBearerSession(tokens.accessToken);
  if (!bearer) {
    throw new Error("the access token did not resolve to a session");
  }
  const [row] = await db
    .select()
    .from(authSession)
    .where(eq(authSession.id, bearer.sessionId));
  return row;
};

const countRefreshTokens = async (sessionId: string): Promise<number> => {
  const rows = await db
    .select({ id: refreshToken.id })
    .from(refreshToken)
    .where(eq(refreshToken.sessionId, sessionId));
  return rows.length;
};

describe("API sessions against a real database", () => {
  beforeEach(async () => {
    await resetMoneyTables();
  });

  afterAll(async () => {
    await closeDatabaseConnection();
  });

  describe("signing in", () => {
    it("opens a session whose access token names the account and the session", async () => {
      // Arrange
      const userId = await seedUser();
      const now = new Date();

      // Act
      const tokens = await signIn(userId, now);
      const bearer = await resolveBearerSession(tokens.accessToken);
      const session = await readSessionOf(tokens);

      // Assert
      expect(bearer).toEqual({ userId, sessionId: session.id });
      expect(session).toMatchObject({
        userId,
        clientKind: "mobile",
        platform: "ios",
        deviceName: "Test iPhone",
        appVersion: "1.2.3",
        createdIp: CLIENT_IP,
        revokedAt: null,
      });
      expect(session.absoluteExpiresAt.getTime() - now.getTime()).toBe(
        SESSION_TTL_DAYS * DAY_MS
      );
      expect(tokens.refreshTokenExpiresAt.getTime() - now.getTime()).toBe(
        REFRESH_TTL_DAYS * DAY_MS
      );
    });

    it("stores the hash of the refresh token, never the token", async () => {
      // Arrange
      const userId = await seedUser();

      // Act
      const tokens = await signIn(userId);
      const stored = await db.select().from(refreshToken);

      // Assert
      expect(stored).toHaveLength(1);
      expect(stored[0].tokenHash).toBe(hashToken(tokens.refreshToken));
      expect(stored[0].tokenHash).not.toBe(tokens.refreshToken);
    });

    it("answers null for an account that does not exist", async () => {
      // Act
      const tokens = await issueTokenPair({
        userId: randomUUID(),
        client: CLIENT,
        ip: null,
      });

      // Assert
      expect(tokens).toBeNull();
    });
  });

  describe("refreshing", () => {
    it("trades the refresh token for a new pair of the same session", async () => {
      // Arrange
      const userId = await seedUser();
      const first = await signIn(userId);
      const session = await readSessionOf(first);

      // Act
      const second = await refresh(first.refreshToken);

      // Assert
      expect(second.refreshToken).not.toBe(first.refreshToken);
      expect(await resolveBearerSession(second.accessToken)).toEqual({
        userId,
        sessionId: session.id,
      });
      expect(await countRefreshTokens(session.id)).toBe(2);
    });

    it("lets the new refresh token be used in turn", async () => {
      // Arrange
      const userId = await seedUser();
      const first = await signIn(userId);
      const second = await refresh(first.refreshToken);

      // Act
      const third = await refresh(second.refreshToken);

      // Assert
      expect(await resolveBearerSession(third.accessToken)).not.toBeNull();
    });

    it("gives a retry within the grace time a pair of its own, twice, then refuses without revoking", async () => {
      // Arrange
      const userId = await seedUser();
      const start = new Date();
      const first = await signIn(userId, start);
      await refresh(first.refreshToken, start);
      const withinGrace = timeAfter(start, (GRACE_SECONDS - 1) * SECOND_MS);

      // Act
      const firstRetry = await refresh(first.refreshToken, withinGrace);
      const secondRetry = await refresh(first.refreshToken, withinGrace);
      const thirdRetry = await refreshStatus(first.refreshToken, withinGrace);

      // Assert
      expect(firstRetry.refreshToken).not.toBe(secondRetry.refreshToken);
      expect(thirdRetry).toBe("refresh_invalid");
      // The session is alive: a sibling's token still refreshes.
      expect(await refreshStatus(secondRetry.refreshToken, withinGrace)).toBe(
        "refreshed"
      );
    });

    it("revokes the session when a used token comes back after the grace time", async () => {
      // Arrange
      const userId = await seedUser();
      const start = new Date();
      const first = await signIn(userId, start);
      const second = await refresh(first.refreshToken, start);
      const afterGrace = timeAfter(start, (GRACE_SECONDS + 1) * SECOND_MS);

      // Act
      const reuse = await refreshStatus(first.refreshToken, afterGrace);

      // Assert
      expect(reuse).toBe("refresh_reused");
      const session = await db.select().from(authSession);
      expect(session[0].revokedReason).toBe("refresh_reused");
      // Both holders are out: the copy and the rightful latest token.
      expect(await refreshStatus(second.refreshToken, afterGrace)).toBe(
        "session_revoked"
      );
      expect(await resolveBearerSession(second.accessToken)).toBeNull();
    });

    it("keeps the session alive under five refreshes at once and mints at most three pairs", async () => {
      // Arrange
      const userId = await seedUser();
      const first = await signIn(userId);
      const session = await readSessionOf(first);

      // Act
      const results = await Promise.all(
        Array.from({ length: PARALLEL_REFRESHES }, () =>
          refreshTokenPair({ refreshToken: first.refreshToken })
        )
      );

      // Assert
      const refreshed = results.filter(
        (result) => result.status === "refreshed"
      );
      const refused = results.filter((result) => result.status !== "refreshed");
      expect(refreshed).toHaveLength(MAX_PAIRS_FROM_ONE_TOKEN);
      expect(refused.map((result) => result.status)).toEqual([
        "refresh_invalid",
        "refresh_invalid",
      ]);
      // The first token and its three children; no row from a refused retry.
      expect(await countRefreshTokens(session.id)).toBe(
        1 + MAX_PAIRS_FROM_ONE_TOKEN
      );
      expect((await readSessionOf(first)).revokedAt).toBeNull();
    });

    it("refuses a refresh token that was unused for 60 days", async () => {
      // Arrange
      const userId = await seedUser();
      const start = new Date();
      const first = await signIn(userId, start);

      // Act
      const status = await refreshStatus(
        first.refreshToken,
        timeAfter(start, REFRESH_TTL_DAYS * DAY_MS)
      );

      // Assert
      expect(status).toBe("refresh_expired");
    });

    it("starts the 60 days anew on each refresh, but never past the session's 180", async () => {
      // Arrange
      const userId = await seedUser();
      const start = new Date();
      const first = await signIn(userId, start);
      const day50 = timeAfter(start, 50 * DAY_MS);
      const day100 = timeAfter(start, 100 * DAY_MS);
      const day150 = timeAfter(start, 150 * DAY_MS);

      // Act
      const second = await refresh(first.refreshToken, day50);
      const third = await refresh(second.refreshToken, day100);
      const fourth = await refresh(third.refreshToken, day150);

      // Assert
      expect(second.refreshTokenExpiresAt).toEqual(
        timeAfter(day50, REFRESH_TTL_DAYS * DAY_MS)
      );
      expect(fourth.refreshTokenExpiresAt).toEqual(
        timeAfter(start, SESSION_TTL_DAYS * DAY_MS)
      );
      expect(
        await refreshStatus(
          fourth.refreshToken,
          timeAfter(start, SESSION_TTL_DAYS * DAY_MS)
        )
      ).toBe("refresh_expired");
    });

    it("refuses a token that was never issued", async () => {
      expect(await refreshStatus("never-issued-refresh-token-0000")).toBe(
        "refresh_invalid"
      );
    });
  });

  describe("checking an access token", () => {
    it("refuses it once the session is past its absolute end", async () => {
      // Arrange
      const userId = await seedUser();
      const tokens = await signIn(userId);

      // Act
      const bearer = await resolveBearerSession(
        tokens.accessToken,
        timeAfter(new Date(), SESSION_TTL_DAYS * DAY_MS)
      );

      // Assert
      expect(bearer).toBeNull();
    });

    it("refuses it when the account's token version moved on", async () => {
      // Arrange
      const userId = await seedUser();
      const tokens = await signIn(userId);
      await db
        .update(user)
        .set({ tokenVersion: sql`${user.tokenVersion} + 1` })
        .where(eq(user.id, userId));

      // Act and assert
      expect(await resolveBearerSession(tokens.accessToken)).toBeNull();
    });

    it("refuses it when the account is deleted", async () => {
      // Arrange
      const userId = await seedUser();
      const tokens = await signIn(userId);
      await db.delete(user).where(eq(user.id, userId));

      // Act and assert
      expect(await resolveBearerSession(tokens.accessToken)).toBeNull();
    });

    it("records the use of the session at most every five minutes", async () => {
      // Arrange
      const userId = await seedUser();
      const start = new Date();
      const tokens = await signIn(userId, start);
      const fourMinutesOn = timeAfter(start, 4 * MINUTE_MS);
      const fiveMinutesOn = timeAfter(start, 5 * MINUTE_MS);

      // Act
      await resolveBearerSession(tokens.accessToken, fourMinutesOn);
      const afterEarlyUse = (await db.select().from(authSession))[0];
      await resolveBearerSession(tokens.accessToken, fiveMinutesOn);
      const afterLaterUse = (await db.select().from(authSession))[0];

      // Assert
      expect(afterEarlyUse.lastUsedAt).toEqual(start);
      expect(afterLaterUse.lastUsedAt).toEqual(fiveMinutesOn);
    });
  });

  describe("signing out", () => {
    it("ends one session: its access token and its refresh token stop working", async () => {
      // Arrange
      const userId = await seedUser();
      const tokens = await signIn(userId);
      const other = await signIn(userId);
      const { id: sessionId } = await readSessionOf(tokens);

      // Act
      const wasAlive = await endSession({ userId, sessionId });
      const wasAliveAgain = await endSession({ userId, sessionId });

      // Assert
      expect(wasAlive).toBe(true);
      expect(wasAliveAgain).toBe(false);
      expect(await resolveBearerSession(tokens.accessToken)).toBeNull();
      expect(await refreshStatus(tokens.refreshToken)).toBe("session_revoked");
      expect(await resolveBearerSession(other.accessToken)).not.toBeNull();
    });

    it("does not let one account end a session of another", async () => {
      // Arrange
      const ownerId = await seedUser();
      const strangerId = await seedUser();
      const tokens = await signIn(ownerId);
      const { id: sessionId } = await readSessionOf(tokens);

      // Act
      const wasEnded = await endSessionById({ userId: strangerId, sessionId });

      // Assert
      expect(wasEnded).toBe(false);
      expect(await resolveBearerSession(tokens.accessToken)).not.toBeNull();
    });

    it("ends every session of the account at once and raises its token version", async () => {
      // Arrange
      const userId = await seedUser();
      const otherUserId = await seedUser();
      const phone = await signIn(userId);
      const tablet = await signIn(userId);
      const stranger = await signIn(otherUserId);

      // Act
      await endAllSessions(userId);

      // Assert
      expect(await resolveBearerSession(phone.accessToken)).toBeNull();
      expect(await resolveBearerSession(tablet.accessToken)).toBeNull();
      expect(await refreshStatus(phone.refreshToken)).toBe("session_revoked");
      // What ends the web cookies of the account.
      expect(await getUserTokenVersion(userId)).toBe(1);
      expect(await resolveBearerSession(stranger.accessToken)).not.toBeNull();
      expect(await getUserTokenVersion(otherUserId)).toBe(0);
    });

    it("ends every API session when the password changes", async () => {
      // Arrange
      const userId = await seedUser();
      const tokens = await signIn(userId);

      // Act
      await updateUserPassword({ userId, hashedPassword: "new-hash" });

      // Assert
      expect(await resolveBearerSession(tokens.accessToken)).toBeNull();
      expect(await refreshStatus(tokens.refreshToken)).toBe("session_revoked");
    });

    it("lets the account sign in again afterwards, under the new version", async () => {
      // Arrange
      const userId = await seedUser();
      await signIn(userId);
      await endAllSessions(userId);

      // Act
      const tokens = await signIn(userId);

      // Assert
      expect(await resolveBearerSession(tokens.accessToken)).not.toBeNull();
    });
  });

  describe("listing sessions", () => {
    it("lists the live sessions of the account, most recently used first", async () => {
      // Arrange
      const userId = await seedUser();
      const start = new Date();
      const twoDaysAgo = timeAfter(start, -2 * DAY_MS);
      const oneDayAgo = timeAfter(start, -1 * DAY_MS);
      await signIn(userId, twoDaysAgo);
      await signIn(userId, oneDayAgo);
      const revoked = await signIn(userId, start);
      const { id: revokedId } = await readSessionOf(revoked);
      await endSession({ userId, sessionId: revokedId });
      await signIn(await seedUser());

      // Act
      const sessions = await listSessions(userId, start);

      // Assert: the revoked session and the other account's are left out.
      expect(sessions.map((session) => session.lastUsedAt)).toEqual([
        oneDayAgo,
        twoDaysAgo,
      ]);
      expect(sessions[0]).toMatchObject({
        platform: "ios",
        deviceName: "Test iPhone",
        appVersion: "1.2.3",
        createdAt: oneDayAgo,
      });
    });

    it("leaves out a session past its absolute end", async () => {
      // Arrange
      const userId = await seedUser();
      const start = new Date();
      await signIn(userId, start);

      // Act
      const sessions = await listSessions(
        userId,
        timeAfter(start, SESSION_TTL_DAYS * DAY_MS)
      );

      // Assert
      expect(sessions).toEqual([]);
    });
  });

  describe("housekeeping", () => {
    it("deletes a session a week past its absolute end, with its refresh tokens", async () => {
      // Arrange
      const userId = await seedUser();
      const start = new Date();
      const tokens = await signIn(userId, start);
      await refresh(tokens.refreshToken, start);
      const absoluteEnd = timeAfter(start, SESSION_TTL_DAYS * DAY_MS);

      // Act
      const tooEarly = await deleteDeadAuthRecords(
        timeAfter(absoluteEnd, 6 * DAY_MS)
      );
      const sessionsLeftEarly = await db.select().from(authSession);
      const deleted = await deleteDeadAuthRecords(
        timeAfter(absoluteEnd, 8 * DAY_MS)
      );

      // Assert: the refresh tokens died long before (60 days after sign-in)
      // and go first; the session row stays a week past its own end.
      expect(tooEarly).toEqual({ sessions: 0, refreshTokens: 2 });
      expect(sessionsLeftEarly).toHaveLength(1);
      expect(deleted).toEqual({ sessions: 1, refreshTokens: 0 });
      expect(await db.select().from(authSession)).toEqual([]);
      expect(await db.select().from(refreshToken)).toEqual([]);
    });

    it("deletes a refresh token a week past its expiry and keeps a used one until then", async () => {
      // Arrange
      const userId = await seedUser();
      const start = new Date();
      const first = await signIn(userId, start);
      const day30 = timeAfter(start, 30 * DAY_MS);
      await refresh(first.refreshToken, day30);
      const firstTokenExpiry = timeAfter(start, REFRESH_TTL_DAYS * DAY_MS);

      // Act: the first token is used, but still inside its own 60 days.
      const whileKept = await deleteDeadAuthRecords(
        timeAfter(firstTokenExpiry, 6 * DAY_MS)
      );
      const whenDead = await deleteDeadAuthRecords(
        timeAfter(firstTokenExpiry, 8 * DAY_MS)
      );

      // Assert
      expect(whileKept).toEqual({ sessions: 0, refreshTokens: 0 });
      expect(whenDead).toEqual({ sessions: 0, refreshTokens: 1 });
      const remaining = await db.select().from(refreshToken);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].tokenHash).not.toBe(hashToken(first.refreshToken));
    });
  });
});
