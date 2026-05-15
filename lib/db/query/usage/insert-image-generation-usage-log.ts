import { ChatSDKError } from "../../../errors";
import { db } from "../../connection";
import { imageGenerationUsageLog } from "../../schema";

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
