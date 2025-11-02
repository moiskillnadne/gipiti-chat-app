import { experimental_generateImage, tool, type UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import type { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";
import { getImageModelId, myProvider } from "../providers";

type GenerateImageProps = {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  selectedChatModel: string;
};

export const generateImageTool = ({
  session,
  dataStream,
  selectedChatModel,
}: GenerateImageProps) =>
  tool({
    description:
      "Generate an image based on a text prompt. Use this tool when the user explicitly asks to create, generate, or draw an image. The prompt should be detailed and descriptive.",
    inputSchema: z.object({
      prompt: z
        .string()
        .describe(
          "A detailed description of the image to generate. Be specific about style, colors, composition, and subject matter."
        ),
      size: z
        .enum(["1024x1024", "1792x1024", "1024x1792"])
        .optional()
        .describe("The size of the image to generate. Defaults to 1024x1024"),
    }),
    execute: async ({ prompt, size = "1024x1024" }) => {
      const imageModelId = getImageModelId(selectedChatModel);

      if (!imageModelId) {
        throw new Error(
          `Image generation is not supported for model: ${selectedChatModel}`
        );
      }

      const id = generateUUID();
      const title = prompt.slice(0, 50) + (prompt.length > 50 ? "..." : "");

      // Send metadata about the image being generated
      dataStream.write({
        type: "data-kind",
        data: "image",
        transient: true,
      });

      dataStream.write({
        type: "data-id",
        data: id,
        transient: true,
      });

      dataStream.write({
        type: "data-title",
        data: title,
        transient: true,
      });

      dataStream.write({
        type: "data-clear",
        data: null,
        transient: true,
      });

      try {
        // Generate the image using AI SDK through the gateway
        const { image } = await experimental_generateImage({
          model: myProvider.imageModel(imageModelId),
          prompt,
          size,
        });

        // Convert image to base64
        const base64Image = image.base64;

        // Stream the image data to the client
        dataStream.write({
          type: "data-imageDelta",
          data: base64Image,
          transient: true,
        });

        dataStream.write({
          type: "data-finish",
          data: null,
          transient: true,
        });

        return {
          id,
          title,
          success: true,
          message: "Image generated successfully and is now visible to the user.",
        };
      } catch (error) {
        console.error("Error generating image:", error);

        dataStream.write({
          type: "data-finish",
          data: null,
          transient: true,
        });

        throw new Error(
          `Failed to generate image: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    },
  });
