import { and, count, eq, gte, lte } from "drizzle-orm";
import { ChatSDKError } from "../../../errors";
import { db } from "../../queries";
import { chat, message } from "../../schema";

export async function getMessageCountByBillingPeriod({
  userId,
  periodStart,
  periodEnd,
}: {
  userId: string;
  periodStart: Date;
  periodEnd: Date;
}): Promise<number> {
  try {
    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, userId),
          eq(message.role, "user"),
          gte(message.createdAt, periodStart),
          lte(message.createdAt, periodEnd)
        )
      )
      .execute();

    return stats?.count ?? 0;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get message count by billing period"
    );
  }
}
