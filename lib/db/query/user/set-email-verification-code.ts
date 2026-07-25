import { sql } from "drizzle-orm";
import { normalizeEmail } from "../../../auth/normalize-email";
import { ChatSDKError } from "../../../errors";
import { db } from "../../connection";
import { user } from "../../schema";

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
      .where(sql`lower(${user.email}) = ${normalizeEmail(email)}`)
      .returning();
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to set email verification code"
    );
  }
}
