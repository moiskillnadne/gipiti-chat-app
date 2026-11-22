import { eq } from "drizzle-orm";

import { ChatSDKError } from "@/lib/errors";
import { db } from "@/server/db/connection";
import { user } from "@/server/db/schema";

/**
 * The account's current token version, or null when the account does not
 * exist (any session that names it is then dead).
 *
 * @throws ChatSDKError when the database cannot be read
 */
export async function getUserTokenVersion(
  userId: string
): Promise<number | null> {
  try {
    const [row] = await db
      .select({ tokenVersion: user.tokenVersion })
      .from(user)
      .where(eq(user.id, userId));

    return row?.tokenVersion ?? null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get user token version"
    );
  }
}
