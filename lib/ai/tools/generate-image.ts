import { tool, type UIMessageStreamWriter } from "ai";
import { z } from "zod";
import type { ChatMessage } from "@/lib/types";

type GenerateImageProps = {
  dataStream: UIMessageStreamWriter<ChatMessage>;
};

export const generateImage = ({ dataStream }: GenerateImageProps) =>
  tool({
    description:
      "Generate images from text descriptions using Google's Imagen 3. Use this when the user asks to create, generate, or make an image.",
    inputSchema: z.object({
      prompt: z
        .string()
        .describe("The text description of the image to generate"),
      aspectRatio: z
        .enum(["1:1", "16:9", "9:16", "4:3", "3:4"])
        .optional()
        .describe("The aspect ratio of the image. Defaults to 1:1"),
      negativePrompt: z
        .string()
        .optional()
        .describe(
          "Elements to avoid in the generated image (e.g., 'blurry, low quality')"
        ),
    }),
    execute: async ({ prompt, aspectRatio, negativePrompt }) => {
      const apiKey = process.env.GOOGLE_API_KEY;

      if (!apiKey) {
        throw new Error(
          "GOOGLE_API_KEY environment variable is not set. Please add your Google AI API key to generate images."
        );
      }

      try {
        // Using OpenAI-compatible endpoint for Gemini API
        const response = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/openai/images/generations",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "imagen-3.0-generate-001",
              prompt,
              n: 1,
              response_format: "b64_json",
              ...(aspectRatio && {
                size:
                  aspectRatio === "1:1"
                    ? "1024x1024"
                    : aspectRatio === "16:9"
                      ? "1792x1024"
                      : aspectRatio === "9:16"
                        ? "1024x1792"
                        : aspectRatio === "4:3"
                          ? "1536x1152"
                          : "1152x1536",
              }),
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Imagen API error:", errorText);
          throw new Error(
            `Failed to generate image: ${response.status} ${response.statusText}`
          );
        }

        const result = await response.json();

        // Extract base64 image data from the OpenAI-compatible response
        // Format: { data: [{ b64_json: "..." }] }
        const base64Image = result.data?.[0]?.b64_json;

        if (!base64Image) {
          throw new Error("No image data in API response");
        }

        // Stream the image data to the client
        dataStream.write({
          type: "data-imageDelta",
          data: base64Image,
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
