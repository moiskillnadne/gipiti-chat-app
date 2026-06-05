import { gateway } from "@ai-sdk/gateway";
import { experimental_generateVideo as generateVideo } from "ai";
import { uploadGeneratedVideo } from "@/lib/ai/media-upload";
import { getVideoGatewayModelId } from "@/lib/ai/models";
import { saveDocument } from "@/lib/db/query/document/save-document";
import { ChatSDKError } from "@/lib/errors";
import type { AppUsage } from "@/lib/usage";
import { generateUUID } from "@/lib/utils";
import { chargeUsageSafe } from "../charge";
import type { ChatTurnContext, StreamWriter } from "../context";

const VIDEO_DURATION_SECONDS = 8;
const VIDEO_ASPECT_RATIO = "16:9";
// Re-emit the (reconciled) "generating" part on this cadence to keep the
// connection alive through the long video generation.
const KEEPALIVE_INTERVAL_MS = 15_000;
const IMAGE_TO_VIDEO_MEDIA_TYPES = new Set(["image/jpeg", "image/png"]);

/**
 * Run a direct video-generation turn: optional image-to-video seeding, a
 * keep-alive heartbeat to hold the connection through the long generation,
 * upload, Document persistence, a balance charge for the provider cost read
 * from gateway metadata, and a usage event carrying the wall-clock duration.
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

  const writeGenerating = () => {
    writer.write({
      id: documentId,
      type: "data-mediaGeneration",
      data: {
        documentId,
        mediaType: "video",
        status: "generating",
        prompt: userPrompt,
        modelId: ctx.model,
      },
    });
  };

  // Drive the media-preview card and keep the connection alive during the long
  // generation by re-emitting the same reconcilable "generating" part.
  writeGenerating();
  const keepAliveInterval = setInterval(writeGenerating, KEEPALIVE_INTERVAL_MS);

  let videoUrl: string | undefined;
  let costUsd = 0;
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

    // Read the provider USD cost from gateway metadata, mirroring image
    // generation (see _lib/image/providers.ts).
    const gatewayCost = (
      result.providerMetadata?.gateway as Record<string, unknown> | undefined
    )?.cost;
    costUsd = gatewayCost == null ? 0 : Number.parseFloat(String(gatewayCost));

    if (result.video) {
      videoUrl = await uploadGeneratedVideo(result.video.uint8Array);
    }
  } catch (error) {
    clearInterval(keepAliveInterval);
    console.error("Video generation failed:", error);
    writer.write({
      id: documentId,
      type: "data-mediaGeneration",
      data: {
        documentId,
        mediaType: "video",
        status: "error",
        prompt: userPrompt,
        modelId: ctx.model,
      },
    });
    return;
  }

  if (!videoUrl) {
    return;
  }

  const generationDuration = Math.round(
    (Date.now() - generationStartTime) / 1000
  );
  const responseId = `vgen-${generateUUID()}`;

  writer.write({
    id: documentId,
    type: "data-mediaGeneration",
    data: {
      documentId,
      mediaType: "video",
      status: "done",
      prompt: userPrompt,
      modelId: ctx.model,
      url: videoUrl,
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

  if (costUsd <= 0) {
    console.warn(
      `Gateway returned no video cost for model "${ctx.model}"; skipping charge`
    );
  }

  // Charge the provider USD cost to the user's balance (no-ops when costUsd
  // is 0). Mirrors the image-generation charge site.
  await chargeUsageSafe(
    {
      userId: ctx.userId,
      usdCost: costUsd,
      modelId: ctx.model,
      chatId: ctx.chatId,
      description: "Video generation",
    },
    "video generation usage"
  );

  const directVideoUsage: AppUsage = {
    modelId: ctx.model,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    inputCost: 0,
    outputCost: costUsd,
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
