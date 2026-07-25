import { gateway } from "@ai-sdk/gateway";
import { APICallError, type SharedV2ProviderOptions } from "@ai-sdk/provider";
import {
  convertToModelMessages,
  type ModelMessage,
  generateImage as sdkGenerateImage,
  streamText,
} from "ai";
import { generateImageGenerationId } from "@/lib/ai/media-upload";
import {
  getDedicatedImageGatewayModelId,
  getModelById,
  isDedicatedImageModel,
  isOpenAIImageModel,
  OPENAI_IMAGE_GATEWAY_MODEL_ID,
} from "@/lib/ai/models";
import { myProvider } from "@/lib/ai/providers";
import { generateRecraftImage, isRecraftModel } from "@/lib/ai/recraft-client";
import { resolveLatestImageUrl } from "@/lib/ai/resolve-latest-image";
import { getDocumentByGenerationId } from "@/lib/db/query/document/get-document-by-generation-id";
import { ChatSDKError } from "@/lib/errors";
import {
  ImageGenerationError,
  type ImageGenResult,
  type ImageProvider,
} from "./types";

const DEFAULT_IMAGE_MEDIA_TYPE = "image/png";

/** Cap on the model-text snippet kept for logging / the error card. */
const TEXT_PREVIEW_MAX_LENGTH = 300;

/**
 * Without this, multimodal image models decide for themselves whether a prompt
 * is an image task: stronger Gemini tiers (Pro / Flash) answer prompts like
 * "создай карточку товара" with copywriting text and no image, which the user
 * sees as a failed generation. Forcing the image modality via
 * `responseModalities: ["IMAGE"]` returns an empty response instead, so a
 * system instruction is the only lever that reliably works.
 */
const MULTIMODAL_IMAGE_SYSTEM_PROMPT =
  "You are an image generation model. Every user message is a request to " +
  "generate or edit an image. Always produce an image in your response — " +
  "never answer with text only. If the request describes a design, card, " +
  "document, banner, or layout, render it as an image.";

/** The edit endpoint requires a concrete size; "auto" is not accepted. */
const OPENAI_EDIT_DEFAULT_SIZE = "1024x1024";

// Card-safe texts for provider request rejections (app locale is ru-only).
const INVALID_ARGUMENT_USER_MESSAGE =
  "Модель отклонила параметры запроса. Попробуйте другие настройки " +
  "изображения или другую модель.";
const SOURCE_IMAGE_FETCH_USER_MESSAGE =
  "Не удалось загрузить исходное изображение для редактирования. " +
  "Прикрепите изображение заново и повторите попытку.";

/**
 * Provider 400s are permanent request rejections (an option the model no
 * longer accepts, or Vertex failing to fetch the edit-base URL) — retrying the
 * same request can never succeed, so the card must say what went wrong instead
 * of showing the blank generic failure users respond to by retrying.
 */
const toImageGenerationError = (
  streamError: unknown,
  modelId: string
): Error => {
  const { statusCode, message } = streamError as {
    statusCode?: unknown;
    message?: unknown;
  };
  const errorMessage =
    typeof message === "string" ? message : JSON.stringify(streamError);

  if (statusCode === 400) {
    const userMessage = errorMessage.includes(
      "fetch content from the provided URL"
    )
      ? SOURCE_IMAGE_FETCH_USER_MESSAGE
      : INVALID_ARGUMENT_USER_MESSAGE;
    return new ImageGenerationError(
      `Image generation rejected (model ${modelId}): ${errorMessage}`,
      userMessage
    );
  }

  return streamError instanceof Error
    ? streamError
    : new Error(`Image generation failed: ${errorMessage}`);
};

/** Download a previously generated image as raw bytes for edit input. */
async function fetchImageBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/** Prompt accepted by `generateImage`: plain text, or image(s) + instruction. */
type ImageEditPrompt = string | { images: Uint8Array[]; text: string };

/**
 * Run an image generation, editing the most recent chat image when one exists.
 * Not every dedicated gateway model accepts image input (e.g. Recraft returns
 * 404 for the edit route), so a failed edit gracefully falls back to plain
 * text-to-image instead of erroring. With no source image it's a direct
 * text-to-image call. The `{ images, text }` form is the AI SDK v6 edit input.
 */
async function runImageEdit<TResult>(
  text: string,
  latestImageUrl: string | undefined,
  run: (prompt: ImageEditPrompt) => Promise<TResult>
): Promise<TResult> {
  if (!latestImageUrl) {
    return run(text);
  }

  const editPrompt: ImageEditPrompt = {
    images: [await fetchImageBytes(latestImageUrl)],
    text,
  };

  try {
    return await run(editPrompt);
  } catch (error) {
    console.warn(
      "Image edit failed (model likely lacks image-input support); falling back to text-to-image",
      error
    );
    return run(text);
  }
}

async function resolvePreviousImageUrl(
  previousGenerationId: string | undefined
): Promise<string | undefined> {
  if (!previousGenerationId) {
    return;
  }
  try {
    const previousDoc = await getDocumentByGenerationId({
      generationId: previousGenerationId,
    });
    if (previousDoc?.content) {
      return previousDoc.content;
    }
    console.warn("Previous document not found, generating new image");
  } catch (error) {
    console.error("Error fetching previous document:", error);
  }
  return;
}

/**
 * gpt-image-1.5 via gateway.imageModel(). Supports text-to-image and edit mode
 * (input image forwarded through generateImage's prompt object). Cost is read
 * from the gateway provider metadata, unlike the prior direct-SDK path which
 * could not report image usage.
 */
const openaiImageProvider: ImageProvider = async ({
  prompt,
  settings,
  previousGenerationId,
  uiMessages,
  onReasoning,
}): Promise<ImageGenResult> => {
  // Prefer the most recent image in the conversation (a freshly attached image
  // or the last generated one) so "edit this" targets what the user is looking
  // at now; fall back to the generation-id chain only when history has none.
  const previousImageUrl =
    resolveLatestImageUrl(uiMessages) ??
    (await resolvePreviousImageUrl(previousGenerationId));
  const isEdit = Boolean(previousImageUrl);
  onReasoning(
    isEdit ? "Editing image with OpenAI..." : "Generating image with OpenAI..."
  );

  // For OpenAI the aspectRatio setting holds a concrete size string
  // ("1024x1024" | "1536x1024" | "1024x1536") or "auto". Map it to `size`;
  // the edit path requires a concrete size, so fall back to the square default.
  const requestedSize =
    settings?.aspectRatio && settings.aspectRatio !== "auto"
      ? settings.aspectRatio
      : undefined;
  const size = isEdit
    ? (requestedSize ?? OPENAI_EDIT_DEFAULT_SIZE)
    : requestedSize;

  // Quality is a provider-specific option ("auto" | "low" | "medium" | "high").
  const providerOptions: SharedV2ProviderOptions | undefined = settings?.quality
    ? { openai: { quality: settings.quality } }
    : undefined;

  try {
    const generationPrompt = previousImageUrl
      ? { images: [await fetchImageBytes(previousImageUrl)], text: prompt }
      : prompt;

    const result = await sdkGenerateImage({
      model: gateway.imageModel(OPENAI_IMAGE_GATEWAY_MODEL_ID),
      prompt: generationPrompt,
      ...(size && { size: size as `${number}x${number}` }),
      ...(providerOptions && { providerOptions }),
    });

    const gatewayCost = (
      result.providerMetadata?.gateway as Record<string, unknown> | undefined
    )?.cost;

    return {
      base64: result.image?.base64,
      mediaType: result.image?.mediaType ?? DEFAULT_IMAGE_MEDIA_TYPE,
      usageMetadata: {
        promptTokenCount: result.usage.inputTokens ?? 0,
        candidatesTokenCount: result.usage.outputTokens ?? 0,
        thoughtsTokenCount: 0,
        totalTokenCount: result.usage.totalTokens ?? 0,
      },
      costUsd: gatewayCost == null ? 0 : Number.parseFloat(String(gatewayCost)),
      responseId: generateImageGenerationId(),
    };
  } catch (error) {
    if (APICallError.isInstance(error)) {
      console.error("OpenAI image generation error:", error);
      if (error.statusCode === 400) {
        throw new ChatSDKError("bad_request:api");
      }
      if (error.statusCode === 429) {
        throw new ChatSDKError("rate_limit:chat");
      }
    }
    throw error;
  }
};

/** Recraft V4 Pro via gateway.imageModel (no style support on V4). */
const recraftImageProvider: ImageProvider = async ({
  prompt,
  settings,
  uiMessages,
  onReasoning,
}): Promise<ImageGenResult> => {
  const latestImageUrl = resolveLatestImageUrl(uiMessages);
  onReasoning(
    latestImageUrl
      ? "Editing image with Recraft..."
      : "Generating image with Recraft..."
  );

  const recraft = await runImageEdit(prompt, latestImageUrl, (imagePrompt) =>
    generateRecraftImage(imagePrompt, {
      aspectRatio: settings?.aspectRatio,
    })
  );

  return {
    base64: recraft.base64,
    mediaType: recraft.mediaType,
    usageMetadata: {
      promptTokenCount: recraft.usage.inputTokens ?? 0,
      candidatesTokenCount: recraft.usage.outputTokens ?? 0,
      thoughtsTokenCount: 0,
      totalTokenCount: recraft.usage.totalTokens ?? 0,
    },
    costUsd: recraft.totalCostUsd ? Number.parseFloat(recraft.totalCostUsd) : 0,
    responseId: generateImageGenerationId(),
  };
};

/**
 * Dedicated gateway image models (grok-imagine-image, flux-2-max,
 * flux-kontext-max). Edits the latest chat image when one exists, else
 * text-to-image. Editing relies on the model accepting image input through the
 * gateway; unsupported models surface a gateway error (caught upstream).
 */
const dedicatedImageProvider: ImageProvider = async ({
  modelId,
  prompt,
  settings,
  uiMessages,
  onReasoning,
}): Promise<ImageGenResult> => {
  const gatewayModelId = getDedicatedImageGatewayModelId(modelId);
  const latestImageUrl = resolveLatestImageUrl(uiMessages);
  onReasoning(latestImageUrl ? "Editing image..." : "Generating image...");

  const result = await runImageEdit(prompt, latestImageUrl, (imagePrompt) =>
    sdkGenerateImage({
      model: gateway.imageModel(gatewayModelId),
      prompt: imagePrompt,
      ...(settings?.aspectRatio && {
        aspectRatio: settings.aspectRatio as `${number}:${number}`,
      }),
    })
  );

  const gatewayCost = (
    result.providerMetadata?.gateway as Record<string, unknown> | undefined
  )?.cost;

  return {
    base64: result.image?.base64,
    mediaType: DEFAULT_IMAGE_MEDIA_TYPE,
    usageMetadata: {
      promptTokenCount: result.usage.inputTokens ?? 0,
      candidatesTokenCount: result.usage.outputTokens ?? 0,
      thoughtsTokenCount: 0,
      totalTokenCount: result.usage.totalTokens ?? 0,
    },
    costUsd: gatewayCost == null ? 0 : Number.parseFloat(String(gatewayCost)),
    responseId: generateImageGenerationId(),
  };
};

/** Multimodal models that emit images via streamText (e.g. Gemini gateway). */
const multimodalImageProvider: ImageProvider = async ({
  modelId,
  prompt,
  settings,
  uiMessages,
  onReasoning,
}): Promise<ImageGenResult> => {
  // Gemini ("Nano Banana") only treats an image as an edit base when it rides on
  // the *current user turn*. Left as an assistant part buried in history, it
  // regenerates from scratch. So when the chat already has an image, send a
  // single user turn of [instruction + image] — same shape gpt-image-2 uses,
  // which edits correctly. With no image, fall back to the full conversation.
  const latestImageUrl = resolveLatestImageUrl(uiMessages);
  const messages: ModelMessage[] = latestImageUrl
    ? [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image", image: new URL(latestImageUrl) },
          ],
        },
      ]
    : await convertToModelMessages(uiMessages);

  const modelDef = getModelById(modelId);
  let mergedProviderOptions: SharedV2ProviderOptions =
    modelDef?.providerOptions ?? {};

  if (modelDef?.provider === "google" && settings) {
    const googleBase =
      (mergedProviderOptions.google as Record<string, unknown>) ?? {};
    const googleImageConfig =
      (googleBase.imageConfig as Record<string, string>) ?? {};
    mergedProviderOptions = {
      ...mergedProviderOptions,
      google: {
        ...googleBase,
        imageConfig: {
          ...googleImageConfig,
          ...(settings.quality && { imageSize: settings.quality }),
          ...(settings.aspectRatio && { aspectRatio: settings.aspectRatio }),
        },
      },
    };
  }

  const result = streamText({
    model: myProvider.languageModel(modelId),
    system: MULTIMODAL_IMAGE_SYSTEM_PROMPT,
    messages,
    providerOptions: mergedProviderOptions,
  });

  let base64: string | undefined;
  let mediaType = DEFAULT_IMAGE_MEDIA_TYPE;
  let usageMetadata: ImageGenResult["usageMetadata"];
  let costUsd = 0;
  let responseId: string | undefined;
  let streamError: unknown;
  let finishReason: string | undefined;
  let textPreview = "";
  const deltaCounts: Record<string, number> = {};

  for await (const delta of result.fullStream) {
    deltaCounts[delta.type] = (deltaCounts[delta.type] ?? 0) + 1;

    if (delta.type === "reasoning-delta") {
      onReasoning(delta.text);
    }

    if (
      delta.type === "text-delta" &&
      textPreview.length < TEXT_PREVIEW_MAX_LENGTH
    ) {
      textPreview += delta.text;
    }

    // streamText surfaces provider failures (e.g. a 400 for an unsupported
    // image size) as error deltas instead of throwing — without this the
    // stream ends with no file and the caller can't tell success from failure.
    if (delta.type === "error") {
      streamError = delta.error;
    }

    if (delta.type === "file") {
      const file = delta.file as { base64Data?: string; mediaType: string };
      if (file.base64Data) {
        base64 = file.base64Data;
        mediaType = file.mediaType;
      }
    }

    if (delta.type === "finish") {
      finishReason = delta.finishReason;
    }

    if (delta.type === "finish-step") {
      const metadata = await result.providerMetadata;
      if (metadata) {
        // The gateway namespaces Google usage under "vertex" (its serving
        // provider), not "google" — check both, plus xai for grok.
        usageMetadata = (metadata.google?.usageMetadata ??
          metadata.vertex?.usageMetadata ??
          metadata.xai?.usageMetadata) as ImageGenResult["usageMetadata"];
        const cost = metadata.gateway?.cost;
        costUsd = cost ? Number.parseFloat(String(cost)) : 0;

        // Extract a provider generation id for future multi-turn editing.
        const genId =
          (typeof metadata.google?.generationId === "string"
            ? metadata.google.generationId
            : null) ??
          (typeof metadata.vertex?.generationId === "string"
            ? metadata.vertex.generationId
            : null) ??
          (typeof metadata.gateway?.generationId === "string"
            ? metadata.gateway.generationId
            : null) ??
          (typeof metadata.generationId === "string"
            ? metadata.generationId
            : null) ??
          null;
        if (genId) {
          responseId = genId;
        }
      }
    }
  }

  if (streamError !== undefined) {
    console.error("Image generation stream error:", { modelId, streamError });
    throw toImageGenerationError(streamError, modelId);
  }

  // A stream that finishes with neither a file nor an error delta is still a
  // failure (e.g. the model replied with text or a safety refusal). Log the
  // full shape of what arrived and surface the model's own words on the card —
  // otherwise this ends as a blank "Не удалось сгенерировать" with no trace.
  if (!base64) {
    const preview = textPreview.trim().slice(0, TEXT_PREVIEW_MAX_LENGTH);
    console.error("Image generation produced no file:", {
      modelId,
      finishReason,
      textPreview: preview,
      deltaCounts,
    });
    throw new ImageGenerationError(
      `Image generation produced no file (model ${modelId}, finishReason ${finishReason ?? "unknown"})`,
      preview || undefined
    );
  }

  return { base64, mediaType, usageMetadata, costUsd, responseId };
};

/** Pick the image provider for a model id. */
export function resolveImageProvider(modelId: string): ImageProvider {
  if (isOpenAIImageModel(modelId)) {
    return openaiImageProvider;
  }
  if (isRecraftModel(modelId)) {
    return recraftImageProvider;
  }
  if (isDedicatedImageModel(modelId)) {
    return dedicatedImageProvider;
  }
  return multimodalImageProvider;
}
