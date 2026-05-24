import {
  generateImageGenerationId,
  uploadGeneratedImage,
} from "@/lib/ai/media-upload";
import { saveDocument } from "@/lib/db/query/document/save-document";
import { ChatSDKError } from "@/lib/errors";
import { generateUUID } from "@/lib/utils";
import { chargeUsageSafe } from "../charge";
import type { ChatTurnContext, StreamWriter } from "../context";
import { resolveImageProvider } from "../image/providers";

const DEFAULT_IMAGE_MEDIA_TYPE = "image/png";

/**
 * Run a direct image-generation turn. Provider-agnostic scaffolding: resolve
 * the provider for the model, stream status/reasoning, upload the bytes,
 * persist a Document, fold usage into the accumulator, and charge the cost.
 */
export async function runImageGeneration(
  ctx: ChatTurnContext,
  writer: StreamWriter
): Promise<void> {
  const userPrompt =
    ctx.message.parts.find((part) => part.type === "text")?.text ?? null;
  if (!userPrompt) {
    throw new ChatSDKError("bad_request:api");
  }

  const documentId = generateUUID();
  writer.write({ id: documentId, type: "reasoning-start" });

  const provider = resolveImageProvider(ctx.model);
  const result = await provider({
    modelId: ctx.model,
    prompt: userPrompt,
    settings: ctx.imageGenSetting,
    previousGenerationId: ctx.previousGenerationId,
    uiMessages: ctx.uiMessages,
    onReasoning: (text) =>
      writer.write({ id: documentId, type: "reasoning-delta", delta: text }),
  });

  let imageUrl: string | undefined;
  if (result.base64) {
    writer.write({
      id: documentId,
      type: "reasoning-delta",
      delta: "Uploading image...",
    });
    imageUrl = await uploadGeneratedImage(
      result.base64,
      result.mediaType ?? DEFAULT_IMAGE_MEDIA_TYPE
    );
  }

  if (imageUrl) {
    writer.write({
      type: "data-imageGenerationFinish",
      data: {
        responseId: result.responseId,
        imageUrl,
        userPrompt,
        usageMetadata: result.usageMetadata,
        documentId,
      },
    });
    writer.write({
      type: "file",
      mediaType: DEFAULT_IMAGE_MEDIA_TYPE,
      url: imageUrl,
    });

    await saveDocument({
      id: documentId,
      title: userPrompt,
      content: imageUrl,
      kind: "image",
      userId: ctx.userId,
      generationId: result.responseId ?? generateImageGenerationId(),
    });
  }

  // Fold image usage into the shared accumulator (mirrors prior behavior:
  // tokens and cost are only counted when the provider reported usage).
  if (result.usageMetadata) {
    const inputTokens = result.usageMetadata.promptTokenCount ?? 0;
    const outputTokens =
      (result.usageMetadata.candidatesTokenCount ?? 0) +
      (result.usageMetadata.thoughtsTokenCount ?? 0);
    ctx.imageUsageAccumulator.totalInputTokens += inputTokens;
    ctx.imageUsageAccumulator.totalOutputTokens += outputTokens;
    ctx.imageUsageAccumulator.totalCost += result.costUsd;
    ctx.imageUsageAccumulator.generationCount += 1;
  }

  await chargeUsageSafe(
    {
      userId: ctx.userId,
      usdCost: result.costUsd,
      modelId: ctx.model,
      chatId: ctx.chatId,
      description: "Image generation",
    },
    "image generation usage"
  );
}
