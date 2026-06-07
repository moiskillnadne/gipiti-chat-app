import { and, eq } from "drizzle-orm";
import { ChatSDKError } from "../../../errors";
import { db } from "../../connection";
import { type QuizResponse, quizResponse } from "../../schema";

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
