import { put } from "@vercel/blob";
import { streamText, tool, type UIMessageStreamWriter } from "ai";
import z from "zod/v4";
import type { ChatMessage } from "../../types";
import { generateUUID } from "../../utils";

async function uploadGeneratedImage(
  base64Data: string,
  mediaType: string
): Promise<string> {
  const buffer = Buffer.from(base64Data, "base64");
  const extension = mediaType.split("/").at(1) ?? "png";
  const filename = `generated-${generateUUID()}.${extension}`;

  const { url } = await put(filename, buffer, { access: "public" });
  return url;
}

type GenerateImageProps = {
  dataStream: UIMessageStreamWriter<ChatMessage>;
};

type GeneratedFileWithBase64 = {
  base64Data?: string;
  mediaType: string;
};

export const generateImageTool = ({ dataStream }: GenerateImageProps) =>
  tool({
    description:
      "Tool for image generation. Use it when you want to generate an image from a prompt.",
    inputSchema: z.object({
      prompt: z.string(),
      modelId: z.string(),
    }),
    execute: async ({ prompt }) => {
      const id = generateUUID();
      let imageUrl: string | undefined;

      console.log("Generating image...");

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
        data: prompt,
        transient: true,
      });

      const result = streamText({
        model: "google/gemini-3-pro-image",
        prompt,
      });

      for await (const delta of result.fullStream) {
        console.dir(delta, { depth: null });
        const { type } = delta;

        if (type === "start") {
          dataStream.write({
            type: "data-textDelta",
            data: "Start generating image...",
          });
        }

        if (type === "text-delta") {
          const { text } = delta;
          dataStream.write({
            type: "data-textDelta",
            data: text,
            transient: true,
          });
        }

        if (type === "reasoning-delta") {
          const { text } = delta;
          dataStream.write({
            type: "data-textDelta",
            data: text,
            transient: true,
          });
        }

        if (type === "file") {
          dataStream.write({
            type: "data-textDelta",
            data: "Uploading image...",
            transient: true,
          });
          const file = delta.file as GeneratedFileWithBase64;
          if (file.base64Data) {
            imageUrl = await uploadGeneratedImage(
              file.base64Data,
              file.mediaType
            );
          }
        }
      }

      dataStream.write({
        type: "data-clear",
        data: null,
        transient: true,
      });

      dataStream.write({ type: "data-finish", data: null, transient: true });

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
