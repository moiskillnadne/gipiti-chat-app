import { sql } from "drizzle-orm";
import { normalizeEmail } from "../../../auth/normalize-email";
import { ChatSDKError } from "../../../errors";
import { db } from "../../connection";
import { user } from "../../schema";

export async function clearEmailVerificationCode(email: string) {
  try {
    return await db
      .update(user)
      .set({
        emailVerificationCode: null,
        emailVerificationCodeExpiry: null,
      })
      .where(sql`lower(${user.email}) = ${normalizeEmail(email)}`);
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to clear email verification code"
    );
  }
}
