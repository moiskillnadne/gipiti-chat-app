import { asc, eq } from "drizzle-orm";
import { db } from "@/server/db/connection";
import { type Prompt, prompt } from "@/server/db/schema";
import { ChatSDKError } from "../../../errors";

export async function getActivePrompts(): Promise<Prompt[]> {
  try {
    return await db
      .select()
      .from(prompt)
      .where(eq(prompt.isActive, true))
      .orderBy(asc(prompt.sortOrder), asc(prompt.createdAt));
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to fetch prompts");
  }
}
