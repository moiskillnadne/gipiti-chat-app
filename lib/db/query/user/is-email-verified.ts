import { sql } from "drizzle-orm";
import { db } from "@/server/db/connection";
import { user } from "@/server/db/schema";
import { normalizeEmail } from "../../../auth/normalize-email";
import { ChatSDKError } from "../../../errors";

export async function isEmailVerified({
  email,
}: {
  email: string;
}): Promise<boolean> {
  try {
    const [foundUser] = await db
      .select({ emailVerified: user.emailVerified })
      .from(user)
      .where(sql`lower(${user.email}) = ${normalizeEmail(email)}`);

    return foundUser?.emailVerified ?? false;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to check email verification status"
    );
  }
}
