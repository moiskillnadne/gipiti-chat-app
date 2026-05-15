import { eq } from "drizzle-orm";
import { ChatSDKError } from "../../../errors";
import { db } from "../../connection";
import { user } from "../../schema";

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
