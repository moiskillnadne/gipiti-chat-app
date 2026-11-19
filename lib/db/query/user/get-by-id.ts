import { eq } from "drizzle-orm";
import { db } from "@/server/db/connection";
import { type User, user } from "@/server/db/schema";
import { ChatSDKError } from "../../../errors";

export async function getUserById(id: string): Promise<User | null> {
  try {
    const [userRecord] = await db.select().from(user).where(eq(user.id, id));
    return userRecord ?? null;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to get user by id");
  }
}
