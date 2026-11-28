import { and, eq } from "drizzle-orm";
import { ChatSDKError } from "@/lib/errors";
import { type DatabaseExecutor, db } from "@/server/db/connection";
import { type QuizResponse, quizResponse } from "@/server/db/schema";

/** Inside a transaction, pass it as `executor`. */
export async function getQuizResponse(
  {
    userId,
    quizKey,
  }: {
    userId: string;
    quizKey: string;
  },
  executor: DatabaseExecutor = db
): Promise<QuizResponse | null> {
  try {
    const [row] = await executor
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
