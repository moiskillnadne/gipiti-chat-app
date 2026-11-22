import { sql } from "drizzle-orm";
import { ChatSDKError } from "@/lib/errors";
import { db } from "@/server/db/connection";
import { user } from "@/server/db/schema";
import { normalizeEmail } from "@/server/modules/auth/normalize-email";

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
        // A new code gets a fresh set of attempts.
        emailVerificationAttempts: 0,
      })
      .where(sql`lower(${user.email}) = ${normalizeEmail(email)}`)
      .returning();
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to set email verification code"
    );
  }
}
