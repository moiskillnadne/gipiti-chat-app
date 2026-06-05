import { asc, eq } from "drizzle-orm";

import { ChatSDKError } from "../../../errors";
import { db } from "../../connection";
import { type Prompt, prompt } from "../../schema";

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
