import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db/connection";
import { authSession, user } from "@/server/db/schema";
import { getUserTokenVersion } from "@/server/modules/users/queries/get-token-version";
import {
  PASSWORD_CHANGED_REVOCATION_REASON,
  updateUserPassword,
} from "@/server/modules/users/queries/update-user-password";
import {
  closeDatabaseConnection,
  resetMoneyTables,
} from "@/tests/integration/helpers";

const OLD_HASH = "old-password-hash";
const NEW_HASH = "new-password-hash";
const RESET_TOKEN_HASH = "c".repeat(64);
const ONE_HOUR_MS = 60 * 60 * 1000;
const EARLIER_REVOCATION_REASON = "logout";

const inOneHour = (): Date => new Date(Date.now() + ONE_HOUR_MS);

const seedUser = async (): Promise<string> => {
  const [created] = await db
    .insert(user)
    .values({
      email: `password-${randomUUID()}@example.test`,
      password: OLD_HASH,
      resetPasswordToken: RESET_TOKEN_HASH,
      resetPasswordTokenExpiry: inOneHour(),
    })
    .returning({ id: user.id });

  return created.id;
};

type SeedSessionInput = { userId: string; revokedReason?: string };

const seedSession = async ({
  userId,
  revokedReason,
}: SeedSessionInput): Promise<string> => {
  const [created] = await db
    .insert(authSession)
    .values({
      userId,
      clientKind: "mobile",
      absoluteExpiresAt: inOneHour(),
      revokedAt: revokedReason ? new Date() : null,
      revokedReason: revokedReason ?? null,
    })
    .returning({ id: authSession.id });

  return created.id;
};

const readUser = async (userId: string) => {
  const [row] = await db.select().from(user).where(eq(user.id, userId));
  return row;
};

const readSession = async (sessionId: string) => {
  const [row] = await db
    .select()
    .from(authSession)
    .where(eq(authSession.id, sessionId));
  return row;
};

describe("updateUserPassword against a real database", () => {
  beforeEach(async () => {
    await resetMoneyTables();
  });

  afterAll(async () => {
    await closeDatabaseConnection();
  });

  it("stores the password, spends the reset token and raises the token version by one", async () => {
    // Arrange
    const userId = await seedUser();

    // Act
    const [updated] = await updateUserPassword({
      userId,
      hashedPassword: NEW_HASH,
    });

    // Assert
    expect(updated.tokenVersion).toBe(1);
    const stored = await readUser(userId);
    expect(stored.password).toBe(NEW_HASH);
    expect(stored.resetPasswordToken).toBeNull();
    expect(stored.resetPasswordTokenExpiry).toBeNull();
    expect(await getUserTokenVersion(userId)).toBe(1);
  });

  it("raises the version again on the next change", async () => {
    // Arrange
    const userId = await seedUser();
    await updateUserPassword({ userId, hashedPassword: NEW_HASH });

    // Act
    const [updated] = await updateUserPassword({
      userId,
      hashedPassword: OLD_HASH,
    });

    // Assert
    expect(updated.tokenVersion).toBe(2);
  });

  it("revokes the account's live sessions and keeps the reason of one revoked before", async () => {
    // Arrange
    const userId = await seedUser();
    const liveSessionId = await seedSession({ userId });
    const revokedSessionId = await seedSession({
      userId,
      revokedReason: EARLIER_REVOCATION_REASON,
    });

    // Act
    await updateUserPassword({ userId, hashedPassword: NEW_HASH });

    // Assert
    const liveSession = await readSession(liveSessionId);
    expect(liveSession.revokedAt).toBeInstanceOf(Date);
    expect(liveSession.revokedReason).toBe(PASSWORD_CHANGED_REVOCATION_REASON);
    const revokedSession = await readSession(revokedSessionId);
    expect(revokedSession.revokedReason).toBe(EARLIER_REVOCATION_REASON);
  });

  it("leaves another account's version and sessions alone", async () => {
    // Arrange
    const userId = await seedUser();
    const otherUserId = await seedUser();
    const otherSessionId = await seedSession({ userId: otherUserId });

    // Act
    await updateUserPassword({ userId, hashedPassword: NEW_HASH });

    // Assert
    expect(await getUserTokenVersion(otherUserId)).toBe(0);
    expect((await readSession(otherSessionId)).revokedAt).toBeNull();
    expect((await readUser(otherUserId)).password).toBe(OLD_HASH);
  });

  it("answers an empty list, and changes nothing, for an account that does not exist", async () => {
    // Act
    const updated = await updateUserPassword({
      userId: randomUUID(),
      hashedPassword: NEW_HASH,
    });

    // Assert
    expect(updated).toEqual([]);
  });

  it("reports no token version for an account that does not exist", async () => {
    expect(await getUserTokenVersion(randomUUID())).toBeNull();
  });
});
