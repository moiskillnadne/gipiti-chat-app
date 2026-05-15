import { eq } from "drizzle-orm";
import { ChatSDKError } from "../../../errors";
import { db } from "../../connection";
import { type User, user } from "../../schema";

export async function getUserByEmail(email: string): Promise<User | null> {
  try {
    const [userRecord] = await db
      .select()
      .from(user)
      .where(eq(user.email, email));

    return userRecord ?? null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get user by email"
    );
  }
}
