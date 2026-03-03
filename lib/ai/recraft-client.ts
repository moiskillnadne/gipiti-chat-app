import { gateway } from "@ai-sdk/gateway";
import { generateImage } from "ai";

export const isRecraftModel = (modelId: string): boolean => {
  return modelId === "recraft-v4-pro";
};

type RecraftImageOptions = {
  aspectRatio?: string;
};

type RecraftImageResult = {
  base64: string;
  mediaType: string;
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  totalCostUsd?: string;
};

export async function generateRecraftImage(
  prompt: string,
  options: RecraftImageOptions = {}
): Promise<RecraftImageResult> {
  const result = await generateImage({
    model: gateway.imageModel("recraft/recraft-v4-pro"),
    prompt,
    ...(options.aspectRatio && {
      aspectRatio: options.aspectRatio as `${number}:${number}`,
    }),
  });

  const image = result.image;
  if (!image) {
    throw new Error("Recraft did not return an image");
  }

  // Extract usage metadata
  const imgUsage = result.usage;

  // Extract cost from provider metadata
  const provMeta = result.providerMetadata;
  const gatewayCost = (provMeta?.gateway as Record<string, unknown> | undefined)
    ?.cost;

  return {
    base64: image.base64,
    mediaType: image.mediaType,
    usage: {
      inputTokens: imgUsage.inputTokens,
      outputTokens: imgUsage.outputTokens,
      totalTokens: imgUsage.totalTokens,
    },
    ...(gatewayCost != null && { totalCostUsd: String(gatewayCost) }),
  };
}
