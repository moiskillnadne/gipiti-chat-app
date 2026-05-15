import { and, count, eq, gte, lte } from "drizzle-orm";

import { ChatSDKError } from "../../../errors";
import { db } from "../../queries";
import { imageGenerationUsageLog } from "../../schema";

export async function getImageGenerationCountByBillingPeriod({
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
      .from(imageGenerationUsageLog)
      .where(
        and(
          eq(imageGenerationUsageLog.userId, userId),
          gte(imageGenerationUsageLog.billingPeriodStart, periodStart),
          lte(imageGenerationUsageLog.billingPeriodEnd, periodEnd)
        )
      );

    return usageCount?.count ?? 0;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get image generation count by billing period"
    );
  }
}
