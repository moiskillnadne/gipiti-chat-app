import { gateway } from "@ai-sdk/gateway";
import type { SharedV2ProviderOptions } from "@ai-sdk/provider";
import {
  convertToModelMessages,
  generateImage as sdkGenerateImage,
  streamText,
} from "ai";
import OpenAI from "openai";
import {
  getDedicatedImageGatewayModelId,
  getModelById,
  isDedicatedImageModel,
} from "@/lib/ai/models";
import {
  downloadImageAsFile,
  generateImageGenerationId,
  isDirectOpenAIModel,
  openaiClient,
} from "@/lib/ai/openai-client";
import { myProvider } from "@/lib/ai/providers";
import { generateRecraftImage, isRecraftModel } from "@/lib/ai/recraft-client";
import { getDocumentById } from "@/lib/db/query/document/get-document-by-id";
import { ChatSDKError } from "@/lib/errors";
import type { ImageGenResult, ImageProvider } from "./types";

const DEFAULT_IMAGE_MEDIA_TYPE = "image/png";

type OpenAIImageSize = "auto" | "1024x1024" | "1536x1024" | "1024x1536";
type OpenAIEditSize = "1024x1024" | "1536x1024" | "1024x1536";
type OpenAIImageQuality = "auto" | "low" | "medium" | "high";

async function resolvePreviousImageUrl(
  previousGenerationId: string | undefined
): Promise<string | undefined> {
  if (!previousGenerationId) {
    return;
  }
  try {
    const previousDoc = await getDocumentById({ id: previousGenerationId });
    if (previousDoc.content) {
      return previousDoc.content;
    }
    console.warn("Previous document not found, generating new image");
  } catch (error) {
    console.error("Error fetching previous document:", error);
  }
  return;
}

/** gpt-image-1.5 via the OpenAI SDK directly (supports edit mode). */
const openaiImageProvider: ImageProvider = async ({
  prompt,
  settings,
  previousGenerationId,
  onReasoning,
}): Promise<ImageGenResult> => {
  const previousImageUrl = await resolvePreviousImageUrl(previousGenerationId);
  onReasoning(
    previousImageUrl
      ? "Editing image with OpenAI..."
      : "Generating image with OpenAI..."
  );

  try {
    let response: OpenAI.Images.ImagesResponse;

    if (previousImageUrl) {
      const imageFile = await downloadImageAsFile(previousImageUrl);
      // The edit API does not support an "auto" size.
      const editSize: OpenAIEditSize =
        settings?.aspectRatio && settings.aspectRatio !== "auto"
          ? (settings.aspectRatio as OpenAIEditSize)
          : "1024x1024";
      response = await openaiClient.images.edit({
        model: "gpt-image-1",
        image: imageFile,
        prompt,
        size: editSize,
        n: 1,
      });
    } else {
      const genSize = (settings?.aspectRatio ?? "auto") as OpenAIImageSize;
      const genQuality = (settings?.quality ?? "auto") as OpenAIImageQuality;
      response = await openaiClient.images.generate({
        model: "gpt-image-1.5",
        prompt,
        size: genSize,
        quality: genQuality,
        n: 1,
      });
    }

    return {
      base64: response.data?.[0]?.b64_json,
      mediaType: DEFAULT_IMAGE_MEDIA_TYPE,
      // OpenAI does not return token counts for images.
      usageMetadata: {
        promptTokenCount: 0,
        candidatesTokenCount: 0,
        thoughtsTokenCount: 0,
        totalTokenCount: 0,
      },
      costUsd: 0,
      responseId: generateImageGenerationId(),
    };
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      console.error("OpenAI API Error:", error);
      if (error.status === 400) {
        throw new ChatSDKError("bad_request:api");
      }
      if (error.status === 429) {
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
  onReasoning,
}): Promise<ImageGenResult> => {
  onReasoning("Generating image with Recraft...");

  const recraft = await generateRecraftImage(prompt, {
    aspectRatio: settings?.aspectRatio,
  });

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

/** Dedicated gateway image models (e.g. grok-imagine-image-pro). */
const dedicatedImageProvider: ImageProvider = async ({
  modelId,
  prompt,
  settings,
  onReasoning,
}): Promise<ImageGenResult> => {
  const gatewayModelId = getDedicatedImageGatewayModelId(modelId);
  onReasoning("Generating image...");

  const result = await sdkGenerateImage({
    model: gateway.imageModel(gatewayModelId),
    prompt,
    ...(settings?.aspectRatio && {
      aspectRatio: settings.aspectRatio as `${number}:${number}`,
    }),
  });

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
  settings,
  uiMessages,
  onReasoning,
}): Promise<ImageGenResult> => {
  const messages = await convertToModelMessages(uiMessages);

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
    messages,
    providerOptions: mergedProviderOptions,
  });

  let base64: string | undefined;
  let mediaType = DEFAULT_IMAGE_MEDIA_TYPE;
  let usageMetadata: ImageGenResult["usageMetadata"];
  let costUsd = 0;
  let responseId: string | undefined;

  for await (const delta of result.fullStream) {
    if (delta.type === "reasoning-delta") {
      onReasoning(delta.text);
    }

    if (delta.type === "file") {
      const file = delta.file as { base64Data?: string; mediaType: string };
      if (file.base64Data) {
        base64 = file.base64Data;
        mediaType = file.mediaType;
      }
    }

    if (delta.type === "finish-step") {
      const metadata = await result.providerMetadata;
      if (metadata) {
        usageMetadata = (metadata.google?.usageMetadata ??
          metadata.xai?.usageMetadata) as ImageGenResult["usageMetadata"];
        const cost = metadata.gateway?.cost;
        costUsd = cost ? Number.parseFloat(String(cost)) : 0;

        // Extract a provider generation id for future multi-turn editing.
        const genId =
          (typeof metadata.google?.generationId === "string"
            ? metadata.google.generationId
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

  return { base64, mediaType, usageMetadata, costUsd, responseId };
};

/** Pick the image provider for a model id. */
export function resolveImageProvider(modelId: string): ImageProvider {
  if (isDirectOpenAIModel(modelId)) {
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
