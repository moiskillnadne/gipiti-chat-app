import { put } from "@vercel/blob";
import { generateUUID } from "@/lib/utils";

/**
 * Upload a base64-encoded image to Vercel Blob and return its public URL.
 * Shared by the chat route's image handler and the generateImage tool.
 */
export async function uploadGeneratedImage(
  base64Data: string,
  mediaType: string
): Promise<string> {
  const buffer = Buffer.from(base64Data, "base64");
  const extension = mediaType.split("/").at(1) ?? "png";
  const filename = `generated-${generateUUID()}.${extension}`;

  const { url } = await put(filename, buffer, { access: "public" });
  return url;
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
