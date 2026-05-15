import { eq } from "drizzle-orm";
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
      .where(eq(user.email, email))
      .returning();
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to set email verification code"
    );
  }
}
