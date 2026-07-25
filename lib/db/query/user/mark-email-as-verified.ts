import { sql } from "drizzle-orm";
import { normalizeEmail } from "../../../auth/normalize-email";
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
      .where(sql`lower(${user.email}) = ${normalizeEmail(email)}`)
      .returning();
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to mark email as verified"
    );
  }
}
