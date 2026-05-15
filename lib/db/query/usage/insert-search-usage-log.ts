import { ChatSDKError } from "../../../errors";
import { db } from "../../queries";
import { searchUsageLog } from "../../schema";

export async function insertSearchUsageLog({
  userId,
  chatId,
  query,
  searchDepth,
  resultsCount,
  responseTimeMs,
  cached,
  billingPeriodType,
  billingPeriodStart,
  billingPeriodEnd,
}: {
  userId: string;
  chatId: string | null;
  query: string;
  searchDepth: string;
  resultsCount: number;
  responseTimeMs: number;
  cached: boolean;
  billingPeriodType: "daily" | "weekly" | "monthly" | "annual";
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
}): Promise<void> {
  try {
    await db.insert(searchUsageLog).values({
      userId,
      chatId,
      query,
      searchDepth,
      resultsCount,
      responseTimeMs,
      cached,
      billingPeriodType,
      billingPeriodStart,
      billingPeriodEnd,
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to insert search usage log"
    );
  }
}
