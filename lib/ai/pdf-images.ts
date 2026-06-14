import "server-only";

import sharp from "sharp";

export type ResolvedPdfImage = { dataUri: string };
export type PdfImageMap = Map<string, ResolvedPdfImage>;

/** Bound the work/size of image embedding (model-authored content). */
const MAX_IMAGES = 20;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;
/** Downscale very large images so the PDF stays a reasonable size. */
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 82;
const HTTP_URL_PATTERN = /^https?:\/\//i;

const isHttpUrl = (url: string): boolean => HTTP_URL_PATTERN.test(url);

/**
 * Fetch one image and encode it as a data URI. pdfkit only supports PNG/JPEG,
 * so everything is normalized through sharp (JPEG kept as JPEG to stay small;
 * anything else becomes PNG) and downscaled. Returns null on any failure so the
 * caller falls back to the image's alt text.
 */
async function fetchAndEncode(url: string): Promise<ResolvedPdfImage | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      return null;
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) {
      return null;
    }

    const metadata = await sharp(bytes).metadata();
    const isJpeg = metadata.format === "jpeg";
    const pipeline = sharp(bytes).resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    });

    const output = isJpeg
      ? await pipeline.jpeg({ quality: JPEG_QUALITY }).toBuffer()
      : await pipeline.png().toBuffer();
    const mimeType = isJpeg ? "image/jpeg" : "image/png";

    return { dataUri: `data:${mimeType};base64,${output.toString("base64")}` };
  } catch (error) {
    console.error("Failed to fetch/encode PDF image", url, error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Resolve the given image URLs to embeddable data URIs, keyed by URL. Only
 * http(s) URLs are fetched (deduped, capped at MAX_IMAGES); unreachable or
 * invalid images are omitted so the renderer can fall back to their alt text.
 */
export async function resolvePdfImages(urls: string[]): Promise<PdfImageMap> {
  const unique = [...new Set(urls.filter(isHttpUrl))].slice(0, MAX_IMAGES);
  const map: PdfImageMap = new Map();

  await Promise.all(
    unique.map(async (url) => {
      const resolved = await fetchAndEncode(url);
      if (resolved) {
        map.set(url, resolved);
      }
    })
  );

  return map;
}
