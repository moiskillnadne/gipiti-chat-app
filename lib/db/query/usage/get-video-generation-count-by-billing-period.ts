import { and, count, eq, gte, lte } from "drizzle-orm";

import { ChatSDKError } from "../../../errors";
import { db } from "../../connection";
import { videoGenerationUsageLog } from "../../schema";

export async function getVideoGenerationCountByBillingPeriod({
  userId,
  periodStart,
  periodEnd,
}: {
  userId: string;
  periodStart: Date;
  periodEnd: Date;
}): Promise<number> {
  try {
    const [usageCount] = await db
      .select({ count: count() })
      .from(videoGenerationUsageLog)
      .where(
        and(
          eq(videoGenerationUsageLog.userId, userId),
          gte(videoGenerationUsageLog.billingPeriodStart, periodStart),
          lte(videoGenerationUsageLog.billingPeriodEnd, periodEnd)
        )
      );

    return usageCount?.count ?? 0;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get video generation count by billing period"
    );
  }
}
