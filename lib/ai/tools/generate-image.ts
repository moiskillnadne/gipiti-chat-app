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
        // Using Google AI for Developers (Gemini API) endpoint
        const response = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
              instances: [
                {
                  prompt,
                },
              ],
              parameters: {
                sampleCount: 1,
                ...(aspectRatio && { aspectRatio }),
                ...(negativePrompt && { negativePrompt }),
                // Ensure we get high quality images
                addWatermark: false,
              },
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

        // Extract base64 image data from the response
        // The response format should be { predictions: [{ bytesBase64Encoded: "..." }] }
        const base64Image =
          result.predictions?.[0]?.bytesBase64Encoded ||
          result.predictions?.[0]?.image;

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
