import OpenAI, { toFile } from "openai";

export const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const isDirectOpenAIModel = (modelId: string): boolean => {
  return modelId === "gpt-image-1.5";
};

export async function downloadImageAsFile(imageUrl: string): Promise<File> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }

  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // OpenAI SDK's toFile helper creates a File-like object
  return toFile(buffer, "image.png", { type: "image/png" });
}

export function generateImageGenerationId(): string {
  // Generate a unique ID for tracking image generation chains
  return `img_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}
