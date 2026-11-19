import { eq } from "drizzle-orm";
import { db } from "@/server/db/connection";
import { user } from "@/server/db/schema";
import { ChatSDKError } from "../../../errors";

export async function clearPasswordResetToken(userId: string) {
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
