import { sql } from "drizzle-orm";
import { db } from "@/server/db/connection";
import { type User, user } from "@/server/db/schema";
import { normalizeEmail } from "../../../auth/normalize-email";
import { ChatSDKError } from "../../../errors";

export async function getUserByEmail(email: string): Promise<User | null> {
  try {
    const [userRecord] = await db
      .select()
      .from(user)
      .where(sql`lower(${user.email}) = ${normalizeEmail(email)}`);

    return userRecord ?? null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get user by email"
    );
  }
}
