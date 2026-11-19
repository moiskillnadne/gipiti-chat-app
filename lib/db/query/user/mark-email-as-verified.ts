import { sql } from "drizzle-orm";
import { db } from "@/server/db/connection";
import { user } from "@/server/db/schema";
import { normalizeEmail } from "../../../auth/normalize-email";
import { ChatSDKError } from "../../../errors";

export async function markEmailAsVerified({ email }: { email: string }) {
  try {
    return await db
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
