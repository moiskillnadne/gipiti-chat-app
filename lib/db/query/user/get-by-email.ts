import { eq } from "drizzle-orm";
import { ChatSDKError } from "../../../errors";
import { db } from "../../queries";
import { type User, user } from "../../schema";

export async function getUserByEmail(email: string): Promise<User[]> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get user by email"
    );
  }
}
