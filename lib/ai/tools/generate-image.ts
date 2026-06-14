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
  /**
   * URL of the most recent image in the conversation (attachment or previously
   * generated). Forwarded to the model as the edit base when the model sets
   * `editPreviousImage`. Resolved per-turn by the caller from chat history.
   */
  latestImageUrl?: string;
};

type GeneratedFileWithBase64 = {
  base64Data?: string;
  mediaType: string;
};

const IMAGE_MODEL_ID = "google/gemini-3-pro-image";

export const generateImageTool = ({
  userId,
  usageAccumulator,
  latestImageUrl,
}: GenerateImageProps) =>
  tool({
    description: `Generate a new image from a text description, OR edit/refine the most recent image already in the conversation.

Creating vs editing:
- Set "editPreviousImage": true when the user wants to modify, refine, adjust, or build on an image that already exists in the conversation — whether they attached it or you generated it earlier (e.g. "make the sky purple", "remove the background", "now make it brighter"). The current image is attached automatically; pass a concise edit instruction as "prompt".
- Set "editPreviousImage": false (or omit) to create a brand-new image unrelated to any existing one (e.g. "draw a cat").

Use this tool when:
- User explicitly asks to create, draw, generate, or visualize an image
- User requests illustrations, artwork, or visual content
- User asks for visual representations of concepts
- User wants to see what something might look like
- User asks to edit, change, or refine an image already in the chat

Do NOT use this tool when:
- User is asking for information or explanations
- User wants to analyze or discuss existing images without producing a new one
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
      editPreviousImage: z
        .boolean()
        .optional()
        .describe(
          "Set true to edit/refine the image already in the conversation (an attachment or one you previously generated). The current image is attached automatically; pass a concise edit instruction as `prompt`. Omit or set false to create a brand-new image."
        ),
    }),
    execute: async ({ prompt, editPreviousImage }) => {
      const id = generateUUID();
      let imageUrl: string | undefined;
      let usageMetadata: ImageUsageMetadata | undefined;
      let totalCostUsd: string | undefined;

      // Forward the existing image as an edit base only when the model asked to
      // edit AND we actually resolved one from history; otherwise text-to-image.
      const isEditing = Boolean(editPreviousImage && latestImageUrl);

      const result =
        isEditing && latestImageUrl
          ? streamText({
              model: IMAGE_MODEL_ID,
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "text", text: prompt },
                    { type: "image", image: new URL(latestImageUrl) },
                  ],
                },
              ],
            })
          : streamText({
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
