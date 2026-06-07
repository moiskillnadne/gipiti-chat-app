import { streamText, tool } from "ai";
import z from "zod/v4";
import { saveDocument } from "../../db/query/document/save-document";
import { isFreeUserById } from "../../subscription/is-free-user";
import { generateUUID } from "../../utils";
import { uploadGeneratedImage } from "../media-upload";

type ImageUsageMetadata = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
};

export type ImageGenerationUsageAccumulator = {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  generationCount: number;
};

export function createImageUsageAccumulator(): ImageGenerationUsageAccumulator {
  return {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCost: 0,
    generationCount: 0,
  };
}

type GenerateImageProps = {
  userId: string;
  chatId: string;
  usageAccumulator?: ImageGenerationUsageAccumulator;
};

type GeneratedFileWithBase64 = {
  base64Data?: string;
  mediaType: string;
};

const IMAGE_MODEL_ID = "google/gemini-3-pro-image";

export const generateImageTool = ({
  userId,
  usageAccumulator,
}: GenerateImageProps) =>
  tool({
    description: `Generate an image from a text description. Use this tool when:
- User explicitly asks to create, draw, generate, or visualize an image
- User requests illustrations, artwork, or visual content
- User asks for visual representations of concepts
- User wants to see what something might look like

Do NOT use this tool when:
- User is asking for information or explanations
- User wants to analyze or discuss existing images
- The request doesn't require visual output
- The request is inappropriate or violates content policies

Prompt-writing best practices:
- Write detailed, descriptive prompts that specify:
  * Subject matter and composition
  * Style (realistic, artistic, cartoon, etc.)
  * Colors and lighting
  * Mood and atmosphere
  * Perspective and framing
- Use "vivid" style for dramatic, hyper-real images
- Use "natural" style for more realistic, subdued images

Example prompt transformation:
- User: "Draw a cat"
- Better prompt: "A fluffy orange tabby cat sitting on a windowsill, warm afternoon sunlight streaming through, photorealistic style with soft bokeh background"`,
    inputSchema: z.object({
      prompt: z.string(),
      modelId: z.string(),
    }),
    execute: async ({ prompt }) => {
      const id = generateUUID();
      let imageUrl: string | undefined;
      let usageMetadata: ImageUsageMetadata | undefined;
      let totalCostUsd: string | undefined;

      const result = streamText({
        model: IMAGE_MODEL_ID,
        prompt,
      });

      for await (const delta of result.fullStream) {
        const { type } = delta;

        if (type === "file") {
          const file = delta.file as GeneratedFileWithBase64;
          if (file.base64Data) {
            imageUrl = await uploadGeneratedImage(
              file.base64Data,
              file.mediaType,
              { watermark: await isFreeUserById(userId) }
            );
          }
        }

        if (type === "finish-step") {
          const metadata = await result.providerMetadata;

          if (metadata) {
            usageMetadata = metadata.google
              ?.usageMetadata as ImageUsageMetadata;
            totalCostUsd = metadata.gateway?.cost?.toString();
          }
        }
      }

      if (imageUrl) {
        await saveDocument({
          id,
          title: prompt,
          content: imageUrl,
          kind: "image",
          userId,
        });
      }

      // Update accumulator for merged usage tracking
      if (usageAccumulator) {
        const inputTokens = usageMetadata?.promptTokenCount ?? 0;
        const outputTokens =
          (usageMetadata?.candidatesTokenCount ?? 0) +
          (usageMetadata?.thoughtsTokenCount ?? 0);
        const cost = totalCostUsd ? Number.parseFloat(totalCostUsd) : 0;

        usageAccumulator.totalInputTokens += inputTokens;
        usageAccumulator.totalOutputTokens += outputTokens;
        usageAccumulator.totalCost += cost;
        usageAccumulator.generationCount += 1;
      }

      // Provider cost flows to the chat onFinish charge via usageAccumulator.

      return {
        id,
        imageUrl,
        content: imageUrl
          ? "Image was generated and uploaded successfully."
          : "Failed to generate image.",
      };
    },
  });

export const generateImage = generateImageTool;
