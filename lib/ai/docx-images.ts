import "server-only";

import { loadDocumentImages } from "./document-images";

export type DocxImageType = "png" | "jpg";

export type ResolvedDocxImage = {
  data: Buffer;
  width: number;
  height: number;
  type: DocxImageType;
};

export type DocxImageMap = Map<string, ResolvedDocxImage>;

/**
 * Resolve the given image URLs to buffers plus pixel dimensions for docx's
 * `ImageRun`, keyed by URL. Loading and its limits live in
 * `loadDocumentImages`; unreachable, refused or invalid images are omitted so
 * the renderer can fall back to their alt text.
 */
export async function resolveDocxImages(urls: string[]): Promise<DocxImageMap> {
  const images = await loadDocumentImages(urls);
  const map: DocxImageMap = new Map();

  for (const [url, { data, width, height, format }] of images) {
    const type: DocxImageType = format === "jpeg" ? "jpg" : "png";
    map.set(url, { data, width, height, type });
  }

  return map;
}
