import { eq } from "drizzle-orm";
import { ChatSDKError } from "../../../errors";
import { db } from "../../queries";
import { user } from "../../schema";

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
