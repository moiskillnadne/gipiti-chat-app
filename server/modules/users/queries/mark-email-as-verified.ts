import { sql } from "drizzle-orm";
import { ChatSDKError } from "@/lib/errors";
import { type DatabaseExecutor, db } from "@/server/db/connection";
import { user } from "@/server/db/schema";
import { normalizeEmail } from "@/server/modules/auth/normalize-email";

/**
 * Marks the account with this email verified and spends its code. Inside a
 * transaction, pass it as `executor`.
 */
export async function markEmailAsVerified(
  { email }: { email: string },
  executor: DatabaseExecutor = db
) {
  try {
    return await executor
      .update(user)
      .set({
        emailVerified: true,
        emailVerificationCode: null,
        emailVerificationCodeExpiry: null,
        emailVerificationAttempts: 0,
        updatedAt: new Date(),
      })
      .where(sql`lower(${user.email}) = ${normalizeEmail(email)}`)
      .returning();
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to mark email as verified"
    );
  }
}
