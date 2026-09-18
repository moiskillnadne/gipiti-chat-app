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

type TextFileUploadOptions = {
  /** File extension without the dot, e.g. "md" or "txt". */
  extension: string;
  /** Media type stored on the blob; charset is appended automatically. */
  contentType: string;
  /**
   * Prefix the file with a UTF-8 byte order mark. Excel on Windows assumes the
   * ANSI code page for BOM-less text files and renders Cyrillic as garbage, so
   * spreadsheet formats want it; Markdown/TXT tooling prefers no BOM.
   */
  withBom?: boolean;
};

/**
 * Upload generated text to Vercel Blob as a UTF-8 file and return its public
 * URL. Shared by every text-format document tool (Markdown, TXT).
 */
export async function uploadGeneratedTextFile(
  text: string,
  { extension, contentType, withBom = false }: TextFileUploadOptions
): Promise<string> {
  const filename = `generated-${generateUUID()}.${extension}`;
  const body = withBom ? `\uFEFF${text}` : text;

  const { url } = await put(filename, Buffer.from(body, "utf8"), {
    access: "public",
    contentType: `${contentType}; charset=utf-8`,
  });
  return url;
}

/** Upload generated Markdown as a .md file. Used by the generateMarkdown tool. */
export const uploadGeneratedMarkdown = (markdown: string): Promise<string> =>
  uploadGeneratedTextFile(markdown, {
    extension: "md",
    contentType: "text/markdown",
  });

/** Upload generated plain text as a .txt file. Used by the generateTxt tool. */
export const uploadGeneratedTxt = (text: string): Promise<string> =>
  uploadGeneratedTextFile(text, {
    extension: "txt",
    contentType: "text/plain",
  });

/**
 * Upload generated CSV as a .csv file (UTF-8 with BOM so Excel opens Cyrillic
 * correctly). Used by the generateCsv tool.
 */
export const uploadGeneratedCsv = (csv: string): Promise<string> =>
  uploadGeneratedTextFile(csv, {
    extension: "csv",
    contentType: "text/csv",
    withBom: true,
  });
