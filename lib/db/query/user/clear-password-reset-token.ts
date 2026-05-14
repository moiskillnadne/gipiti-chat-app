import { eq } from "drizzle-orm";
import { ChatSDKError } from "../../../errors";
import { db } from "../../queries";
import { user } from "../../schema";

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
