import { and, count, eq, gte, lte } from "drizzle-orm";

import { ChatSDKError } from "../../../errors";
import { db } from "../../queries";
import { searchUsageLog } from "../../schema";

export async function getSearchUsageCountByDateRange({
  userId,
  startDate,
  endDate,
}: {
  userId: string;
  startDate: Date;
  endDate: Date;
}): Promise<number> {
  try {
    const [usageCount] = await db
      .select({ count: count() })
      .from(searchUsageLog)
      .where(
        and(
          eq(searchUsageLog.userId, userId),
          gte(searchUsageLog.createdAt, startDate),
          lte(searchUsageLog.createdAt, endDate)
        )
      );

    return usageCount?.count ?? 0;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get search usage count by date range"
    );
  }
}
