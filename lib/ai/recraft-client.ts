import { gateway } from "@ai-sdk/gateway";
import { generateImage } from "ai";

export const isRecraftModel = (modelId: string): boolean => {
  return modelId === "recraft-v4.1-pro";
};

type RecraftImageOptions = {
  aspectRatio?: string;
};

/** Plain text-to-image, or image(s) + instruction for an edit. */
type RecraftPrompt = string | { images: Uint8Array[]; text: string };

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
  prompt: RecraftPrompt,
  options: RecraftImageOptions = {}
): Promise<RecraftImageResult> {
  const result = await generateImage({
    model: gateway.imageModel("recraft/recraft-v4.1-pro"),
    prompt,
    ...(options.aspectRatio && {
      aspectRatio: options.aspectRatio as `${number}:${number}`,
    }),
  });

  console.log("generateRecraftImage result");
  console.dir(result, { depth: null });

  const image = result.image;
  if (!image) {
    throw new Error("Recraft did not return an image");
  }

  // Extract usage metadata
  const imgUsage = result.usage;

  console.log("generateRecraftImage imgUsage");
  console.dir(imgUsage, { depth: null });

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
