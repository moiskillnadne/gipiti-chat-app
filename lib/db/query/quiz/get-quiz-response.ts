import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/connection";
import { type QuizResponse, quizResponse } from "@/server/db/schema";
import { ChatSDKError } from "../../../errors";

export async function getQuizResponse({
  userId,
  quizKey,
}: {
  userId: string;
  quizKey: string;
}): Promise<QuizResponse | null> {
  try {
    const [row] = await db
      .select()
      .from(quizResponse)
      .where(
        and(eq(quizResponse.userId, userId), eq(quizResponse.quizKey, quizKey))
      )
      .limit(1);

    return row ?? null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to load quiz response"
    );
  }
}
