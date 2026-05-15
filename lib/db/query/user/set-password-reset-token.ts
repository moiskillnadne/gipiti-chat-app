import { eq } from "drizzle-orm";
import { ChatSDKError } from "../../../errors";
import { db } from "../../connection";
import { user } from "../../schema";

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
