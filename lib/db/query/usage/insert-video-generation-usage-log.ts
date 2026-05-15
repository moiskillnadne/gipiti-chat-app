import { ChatSDKError } from "../../../errors";
import { db } from "../../connection";
import { videoGenerationUsageLog } from "../../schema";

export async function insertVideoGenerationUsageLog({
  userId,
  chatId,
  modelId,
  prompt,
  videoUrl,
  generationId,
  success,
  durationSeconds,
  totalCostUsd,
  billingPeriodType,
  billingPeriodStart,
  billingPeriodEnd,
}: {
  userId: string;
  chatId: string | null;
  modelId: string;
  prompt: string;
  videoUrl: string | null;
  generationId: string | null;
  success: boolean;
  durationSeconds: number;
  totalCostUsd: string | null;
  billingPeriodType: "daily" | "weekly" | "monthly" | "annual";
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
}): Promise<void> {
  try {
    await db.insert(videoGenerationUsageLog).values({
      userId,
      chatId,
      modelId,
      prompt,
      videoUrl,
      generationId,
      success,
      durationSeconds,
      totalCostUsd,
      billingPeriodType,
      billingPeriodStart,
      billingPeriodEnd,
    });
  } catch (error) {
    console.error("Video generation usage log insert error:", error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to insert video generation usage log"
    );
  }
}
