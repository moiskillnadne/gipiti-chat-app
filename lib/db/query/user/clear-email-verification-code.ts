import { sql } from "drizzle-orm";
import { db } from "@/server/db/connection";
import { user } from "@/server/db/schema";
import { normalizeEmail } from "../../../auth/normalize-email";
import { ChatSDKError } from "../../../errors";

export async function clearEmailVerificationCode(email: string) {
  try {
    return await db
      .update(user)
      .set({
        emailVerificationCode: null,
        emailVerificationCodeExpiry: null,
        emailVerificationAttempts: 0,
      })
      .where(sql`lower(${user.email}) = ${normalizeEmail(email)}`);
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to clear email verification code"
    );
  }
}
