import { gateway } from "@ai-sdk/gateway";
import { experimental_generateVideo as generateVideo } from "ai";
import { uploadGeneratedVideo } from "@/lib/ai/media-upload";
import { getVideoGatewayModelId } from "@/lib/ai/models";
import { saveDocument } from "@/lib/db/query/document/save-document";
import { ChatSDKError } from "@/lib/errors";
import type { AppUsage } from "@/lib/usage";
import { generateUUID } from "@/lib/utils";
import type { ChatTurnContext, StreamWriter } from "../context";

const VIDEO_DURATION_SECONDS = 8;
const VIDEO_ASPECT_RATIO = "16:9";
const KEEPALIVE_INTERVAL_MS = 15_000;
const IMAGE_TO_VIDEO_MEDIA_TYPES = new Set(["image/jpeg", "image/png"]);

/**
 * Run a direct video-generation turn: optional image-to-video seeding, a
 * keep-alive heartbeat to hold the connection through the long generation,
 * upload, Document persistence, and a usage event carrying the wall-clock
 * duration. Video provider cost is not yet surfaced by the gateway, so no
 * charge is applied (see the TODO below).
 */
export async function runVideoGeneration(
  ctx: ChatTurnContext,
  writer: StreamWriter
): Promise<void> {
  const userPrompt =
    ctx.message.parts.find((part) => part.type === "text")?.text ?? null;
  if (!userPrompt) {
    throw new ChatSDKError("bad_request:api");
  }

  // Seed image-to-video generation from the first image attachment, if any.
  const imageAttachment = ctx.message.parts.find(
    (part) =>
      part.type === "file" && IMAGE_TO_VIDEO_MEDIA_TYPES.has(part.mediaType)
  );
  const referenceImageUrl =
    imageAttachment?.type === "file" ? imageAttachment.url : undefined;

  const documentId = generateUUID();
  const generationStartTime = Date.now();

  writer.write({ id: documentId, type: "reasoning-start" });
  writer.write({
    id: documentId,
    type: "reasoning-delta",
    delta: "Generating video...",
  });

  // Periodic dots keep the connection alive during the long generation.
  const keepAliveInterval = setInterval(() => {
    writer.write({ id: documentId, type: "reasoning-delta", delta: "." });
  }, KEEPALIVE_INTERVAL_MS);

  let videoUrl: string | undefined;
  try {
    const gatewayModelId = getVideoGatewayModelId(ctx.model);
    const videoPrompt = referenceImageUrl
      ? { image: referenceImageUrl, text: userPrompt }
      : userPrompt;

    const result = await generateVideo({
      model: gateway.videoModel(gatewayModelId),
      prompt: videoPrompt,
      aspectRatio: VIDEO_ASPECT_RATIO,
      duration: VIDEO_DURATION_SECONDS,
    });

    clearInterval(keepAliveInterval);

    writer.write({
      id: documentId,
      type: "reasoning-delta",
      delta: " Uploading video...",
    });

    if (result.video) {
      videoUrl = await uploadGeneratedVideo(result.video.uint8Array);
    }
  } catch (error) {
    clearInterval(keepAliveInterval);
    console.error("Video generation failed:", error);
    throw error;
  }

  if (!videoUrl) {
    return;
  }

  const generationDuration = Math.round(
    (Date.now() - generationStartTime) / 1000
  );
  const responseId = `vgen-${generateUUID()}`;

  writer.write({
    type: "data-videoGenerationFinish",
    data: {
      responseId,
      videoUrl,
      userPrompt,
      durationSeconds: VIDEO_DURATION_SECONDS,
    },
  });
  writer.write({ type: "file", mediaType: "video/mp4", url: videoUrl });

  await saveDocument({
    id: documentId,
    title: userPrompt,
    content: videoUrl,
    kind: "video",
    userId: ctx.userId,
    generationId: responseId,
  });

  // Video provider cost is not yet surfaced by the gateway response, so no
  // charge is applied here. TODO(billing): call chargeUsage once the video
  // provider USD cost is available at this point.

  const directVideoUsage: AppUsage = {
    modelId: ctx.model,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    inputCost: 0,
    outputCost: 0,
    inputTokenDetails: {
      noCacheTokens: undefined,
      cacheReadTokens: undefined,
      cacheWriteTokens: undefined,
    },
    outputTokenDetails: {
      textTokens: undefined,
      reasoningTokens: undefined,
    },
  };

  writer.write({
    type: "data-usage",
    data: {
      ...directVideoUsage,
      generationDurationSeconds: generationDuration,
    },
  });
}
