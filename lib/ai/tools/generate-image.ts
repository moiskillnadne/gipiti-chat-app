import {
  experimental_generateImage as generateImage,
  tool,
  type UIMessageStreamWriter,
} from "ai";
import { z } from "zod";
import { gateway } from "@ai-sdk/gateway";
import type { ChatMessage } from "@/lib/types";

type GenerateImageToolProps = {
  dataStream: UIMessageStreamWriter<ChatMessage>;
};

export const generateImageTool = ({
  dataStream,
}: GenerateImageToolProps) =>
  tool({
    description:
      "Generate images from text descriptions using Google's Imagen 4. Use this when the user asks to create, generate, or make an image.",
    inputSchema: z.object({
      prompt: z
        .string()
        .describe("The text description of the image to generate"),
      aspectRatio: z
        .enum(["1:1", "16:9", "9:16", "4:3", "3:4"])
        .optional()
        .describe("The aspect ratio of the image. Defaults to 1:1"),
    }),
    execute: async ({ prompt, aspectRatio }) => {
      try {
        // Using AI Gateway with Imagen 4.0
        const { image } = await generateImage({
          model: gateway.imageModel("google/imagen-4.0-generate-001"),
          prompt,
          ...(aspectRatio && { aspectRatio }),
        });

        // Convert image to base64 string
        const base64 = await image.base64;

        // Stream the image data to the client
        dataStream.write({
          type: "data-imageDelta",
          data: base64,
        });

        return {
          success: true,
          message: `Generated image based on: "${prompt}"`,
        };
      } catch (error) {
        console.error("Error generating image:", error);
        throw error;
      }
    },
  });
