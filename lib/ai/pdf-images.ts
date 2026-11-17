import "server-only";

import { loadDocumentImages } from "./document-images";

export type ResolvedPdfImage = { dataUri: string };
export type PdfImageMap = Map<string, ResolvedPdfImage>;

/**
 * Resolve the given image URLs to embeddable data URIs, keyed by URL. Loading
 * and its limits live in `loadDocumentImages`; unreachable, refused or invalid
 * images are omitted so the renderer can fall back to their alt text.
 */
export async function resolvePdfImages(urls: string[]): Promise<PdfImageMap> {
  const images = await loadDocumentImages(urls);
  const map: PdfImageMap = new Map();

  for (const [url, { data, format }] of images) {
    const dataUri = `data:image/${format};base64,${data.toString("base64")}`;
    map.set(url, { dataUri });
  }

  return map;
}
