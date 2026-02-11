/**
 * User account queries.
 * Handles user creation, password management (reset tokens, updates),
 * and email verification (codes, status checks).
 */
import { and, eq, gt } from "drizzle-orm";

import { ChatSDKError } from "../../errors";
import { type User, user } from "../schema";
import { generateHashedPassword } from "../utils";
import { db } from "./connection";

export async function createUser(
  email: string,
  password: string,
  // Temporarily default to Russian - was "en"
  preferredLanguage = "ru"
) {
  const hashedPassword = generateHashedPassword(password);

  try {
    const [newUser] = await db
      .insert(user)
      .values({
        email,
        password: hashedPassword,
        preferredLanguage,
        currentPlan: null, // No default plan - users must subscribe to get access
      })
      .returning();
    return newUser;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to create user");
  }
}

export async function setPasswordResetToken({
  userId,
  hashedToken,
  expiresAt,
}: {
  userId: string;
  hashedToken: string;
  expiresAt: Date;
}) {
  try {
    return await db
      .update(user)
      .set({
        resetPasswordToken: hashedToken,
        resetPasswordTokenExpiry: expiresAt,
      })
      .where(eq(user.id, userId))
      .returning();
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to set password reset token"
    );
  }
}

export async function getUserByResetToken({
  hashedToken,
}: {
  hashedToken: string;
}): Promise<User | null> {
  try {
    const [foundUser] = await db
      .select()
      .from(user)
      .where(
        and(
          eq(user.resetPasswordToken, hashedToken),
          gt(user.resetPasswordTokenExpiry, new Date())
        )
      );

    return foundUser || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get user by reset token"
    );
  }
}

export async function clearPasswordResetToken({ userId }: { userId: string }) {
  try {
    return await db
      .update(user)
      .set({
        resetPasswordToken: null,
        resetPasswordTokenExpiry: null,
      })
      .where(eq(user.id, userId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to clear password reset token"
    );
  }
}

export async function updateUserPassword({
  userId,
  hashedPassword,
}: {
  userId: string;
  hashedPassword: string;
}) {
  try {
    return await db
      .update(user)
      .set({
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordTokenExpiry: null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId))
      .returning();
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update user password"
    );
  }
}

export async function setEmailVerificationCode({
  email,
  hashedCode,
  expiresAt,
}: {
  email: string;
  hashedCode: string;
  expiresAt: Date;
}) {
  try {
    return await db
      .update(user)
      .set({
        emailVerificationCode: hashedCode,
        emailVerificationCodeExpiry: expiresAt,
      })
      .where(eq(user.email, email))
      .returning();
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to set email verification code"
    );
  }
}

export async function getUserByVerificationCode({
  hashedCode,
}: {
  hashedCode: string;
}): Promise<User | null> {
  try {
    const [foundUser] = await db
      .select()
      .from(user)
      .where(
        and(
          eq(user.emailVerificationCode, hashedCode),
          gt(user.emailVerificationCodeExpiry, new Date())
        )
      );

    return foundUser || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get user by verification code"
    );
  }
}

export async function markEmailAsVerified({ email }: { email: string }) {
  try {
    return await db
      .update(user)
      .set({
        emailVerified: true,
        emailVerificationCode: null,
        emailVerificationCodeExpiry: null,
        updatedAt: new Date(),
      })
      .where(eq(user.email, email))
      .returning();
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to mark email as verified"
    );
  }
}

export async function isEmailVerified({
  email,
}: {
  email: string;
}): Promise<boolean> {
  try {
    const [foundUser] = await db
      .select({ emailVerified: user.emailVerified })
      .from(user)
      .where(eq(user.email, email));

    return foundUser?.emailVerified ?? false;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to check email verification status"
    );
  }
}

export async function clearEmailVerificationCode({ email }: { email: string }) {
  try {
    return await db
      .update(user)
      .set({
        emailVerificationCode: null,
        emailVerificationCodeExpiry: null,
      })
      .where(eq(user.email, email));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to clear email verification code"
    );
  }
}
