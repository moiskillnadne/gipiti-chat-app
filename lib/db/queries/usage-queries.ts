/**
 * Usage tracking queries.
 * Handles search usage logging and billing-period aggregation,
 * and image generation usage logging and count retrieval.
 */
import { and, count, eq, gte, lte } from "drizzle-orm";

import { ChatSDKError } from "../../errors";
import { imageGenerationUsageLog, searchUsageLog } from "../schema";
import { db } from "./connection";

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

export async function getSearchUsageCountByBillingPeriod({
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
      .from(searchUsageLog)
      .where(
        and(
          eq(searchUsageLog.userId, userId),
          gte(searchUsageLog.billingPeriodStart, periodStart),
          lte(searchUsageLog.billingPeriodEnd, periodEnd)
        )
      );

    return usageCount?.count ?? 0;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get search usage count by billing period"
    );
  }
}

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

export async function insertImageGenerationUsageLog({
  userId,
  chatId,
  modelId,
  prompt,
  imageUrl,
  generationId,
  success,
  promptTokens,
  candidatesTokens,
  thoughtsTokens,
  totalTokens,
  totalCostUsd,
  billingPeriodType,
  billingPeriodStart,
  billingPeriodEnd,
}: {
  userId: string;
  chatId: string | null;
  modelId: string;
  prompt: string;
  imageUrl: string | null;
  generationId: string | null;
  success: boolean;
  promptTokens: number;
  candidatesTokens: number;
  thoughtsTokens: number;
  totalTokens: number;
  totalCostUsd: string | null;
  billingPeriodType: "daily" | "weekly" | "monthly" | "annual";
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
}): Promise<void> {
  try {
    await db.insert(imageGenerationUsageLog).values({
      userId,
      chatId,
      modelId,
      prompt,
      imageUrl,
      generationId,
      success,
      promptTokens,
      candidatesTokens,
      thoughtsTokens,
      totalTokens,
      totalCostUsd,
      billingPeriodType,
      billingPeriodStart,
      billingPeriodEnd,
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to insert image generation usage log"
    );
  }
}

export async function getImageGenerationCountByDateRange({
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
      .from(imageGenerationUsageLog)
      .where(
        and(
          eq(imageGenerationUsageLog.userId, userId),
          gte(imageGenerationUsageLog.createdAt, startDate),
          lte(imageGenerationUsageLog.createdAt, endDate)
        )
      );

    return usageCount?.count ?? 0;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get image generation count by date range"
    );
  }
}

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
