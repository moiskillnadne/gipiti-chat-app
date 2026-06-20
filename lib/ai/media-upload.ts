import { put } from "@vercel/blob";
import { applyImageWatermark } from "@/lib/ai/watermark";
import { generateUUID } from "@/lib/utils";

type UploadGeneratedImageOptions = {
  /** When true, composite the app logo watermark before uploading (free users). */
  watermark?: boolean;
};

/**
 * Upload a base64-encoded image to Vercel Blob and return its public URL.
 * Shared by the chat route's image handler and the generateImage tool.
 */
export async function uploadGeneratedImage(
  base64Data: string,
  mediaType: string,
  options?: UploadGeneratedImageOptions
): Promise<string> {
  let buffer: Buffer = Buffer.from(base64Data, "base64");
  if (options?.watermark) {
    buffer = await applyImageWatermark(buffer);
  }

  const extension = mediaType.split("/").at(1) ?? "png";
  const filename = `generated-${generateUUID()}.${extension}`;

  const { url } = await put(filename, buffer, { access: "public" });
  return url;
}

/**
 * Generate a unique id for tracking an image generation/edit chain.
 */
export function generateImageGenerationId(): string {
  return `img_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Upload raw video bytes to Vercel Blob as an mp4 and return its public URL.
 */
export async function uploadGeneratedVideo(
  videoData: Uint8Array
): Promise<string> {
  const buffer = Buffer.from(videoData);
  const filename = `generated-video-${generateUUID()}.mp4`;

  const { url } = await put(filename, buffer, {
    access: "public",
    contentType: "video/mp4",
  });
  return url;
}

/**
 * Upload a generated PDF Buffer to Vercel Blob and return its public URL.
 * Shared by the generatePdf tool.
 */
export async function uploadGeneratedPdf(pdfData: Buffer): Promise<string> {
  const filename = `generated-${generateUUID()}.pdf`;

  const { url } = await put(filename, pdfData, {
    access: "public",
    contentType: "application/pdf",
  });
  return url;
}

/**
 * Upload a generated DOCX Buffer to Vercel Blob and return its public URL.
 * Shared by the generateDocx tool.
 */
export async function uploadGeneratedDocx(docxData: Buffer): Promise<string> {
  const filename = `generated-${generateUUID()}.docx`;

  const { url } = await put(filename, docxData, {
    access: "public",
    contentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  return url;
}
