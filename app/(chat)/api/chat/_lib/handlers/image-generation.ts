import {
  generateImageGenerationId,
  uploadGeneratedImage,
} from "@/lib/ai/media-upload";
import { normalizeAspectRatio } from "@/lib/ai/models";
import { saveDocument } from "@/lib/db/query/document/save-document";
import { ChatSDKError } from "@/lib/errors";
import { isFreeUserById } from "@/lib/subscription/is-free-user";
import { generateUUID } from "@/lib/utils";
import { chargeUsageSafe } from "../charge";
import type { ChatTurnContext, StreamWriter } from "../context";
import { resolveImageProvider } from "../image/providers";
import { ImageGenerationError } from "../image/types";
import {
  createMediaPartWriter,
  MEDIA_FILE_TYPES,
  type MediaPartBase,
} from "../media-part";

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
  const startedAt = Date.now();
  // Shape the preview card to the chosen format ("auto" → undefined → square).
  const aspectRatio = normalizeAspectRatio(ctx.imageGenSetting?.aspectRatio);
  const mediaPartBase: MediaPartBase = {
    documentId,
    mediaType: "image",
    prompt: userPrompt,
    modelId: ctx.model,
    aspectRatio,
  };
  const writeMedia = createMediaPartWriter(ctx, writer, mediaPartBase);

  // Drive the media-preview card: emit the "generating" lifecycle part up front.
  // Reusing the same part `id` lets later writes (done/error/stopped) replace it.
  const writeGenerating = () => {
    writeMedia("generating");
  };

  writeGenerating();

  let result: Awaited<ReturnType<ReturnType<typeof resolveImageProvider>>>;
  let imageUrl: string | undefined;
  // A stop is honoured only while the provider is still working: once it has
  // returned, the result is paid for and is delivered.
  let isProviderResolved = false;
  try {
    const provider = resolveImageProvider(ctx.model);
    result = await provider({
      modelId: ctx.model,
      prompt: userPrompt,
      settings: ctx.imageGenSetting,
      previousGenerationId: ctx.previousGenerationId,
      uiMessages: ctx.uiMessages,
      abortSignal: ctx.turnAbort.signal,
      // Re-emit the (reconciled) generating part as the provider streams, which
      // keeps the connection flushing while the card stays in its loading state.
      onReasoning: writeGenerating,
    });
    isProviderResolved = true;

    if (result.base64) {
      imageUrl = await uploadGeneratedImage(
        result.base64,
        result.mediaType ?? DEFAULT_IMAGE_MEDIA_TYPE,
        { watermark: await isFreeUserById(ctx.userId) }
      );
    }
  } catch (error) {
    if (ctx.turnAbort.signal.aborted && !isProviderResolved) {
      console.info("[media-stop]", {
        chatId: ctx.chatId,
        modelId: ctx.model,
        mediaType: "image",
        elapsedMs: Date.now() - startedAt,
      });
      writeMedia("stopped");
      ctx.turnOutcome = "aborted";
      return;
    }
    console.error("Image generation failed:", { modelId: ctx.model, error });
    // Only ImageGenerationError carries a card-safe message (the model's own
    // reply); internal errors stay generic on the card.
    writeMedia(
      "error",
      error instanceof ImageGenerationError && error.userMessage
        ? { errorMessage: error.userMessage }
        : {}
    );
    ctx.turnOutcome = "completed";
    return;
  }

  ctx.turnOutcome = "completed";

  if (imageUrl) {
    writeMedia("done", {
      url: imageUrl,
      generationId: result.responseId,
    });
    writer.write({
      type: "file",
      mediaType: MEDIA_FILE_TYPES.image,
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
  } else {
    // The stream completed without producing an image (e.g. the model answered
    // with text only). Resolve the card — otherwise it spins forever.
    console.error("Image generation returned no image url:", {
      modelId: ctx.model,
      hasBase64: Boolean(result.base64),
    });
    writeMedia("error");
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

  if (imageUrl && result.costUsd <= 0) {
    console.warn(
      `Gateway returned no image cost for model "${ctx.model}"; skipping charge`
    );
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
