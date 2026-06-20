import "server-only";

import sharp from "sharp";

export type DocxImageType = "png" | "jpg";

export type ResolvedDocxImage = {
  data: Buffer;
  width: number;
  height: number;
  type: DocxImageType;
};

export type DocxImageMap = Map<string, ResolvedDocxImage>;

/** Bound the work/size of image embedding (model-authored content). */
const MAX_IMAGES = 20;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;
/** Downscale very large images so the .docx stays a reasonable size. */
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 82;
const HTTP_URL_PATTERN = /^https?:\/\//i;

const isHttpUrl = (url: string): boolean => HTTP_URL_PATTERN.test(url);

/**
 * Fetch one image and decode it to a buffer plus pixel dimensions for docx's
 * `ImageRun`. Everything is normalized through sharp (JPEG kept as JPEG to stay
 * small; anything else becomes PNG) and downscaled. Returns null on any failure
 * so the caller falls back to the image's alt text.
 */
async function fetchAndDecode(url: string): Promise<ResolvedDocxImage | null> {
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

    const { data, info } = isJpeg
      ? await pipeline
          .jpeg({ quality: JPEG_QUALITY })
          .toBuffer({ resolveWithObject: true })
      : await pipeline.png().toBuffer({ resolveWithObject: true });

    return {
      data,
      width: info.width,
      height: info.height,
      type: isJpeg ? "jpg" : "png",
    };
  } catch (error) {
    console.error("Failed to fetch/decode DOCX image", url, error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Resolve the given image URLs to embeddable buffers, keyed by URL. Only http(s)
 * URLs are fetched (deduped, capped at MAX_IMAGES); unreachable or invalid
 * images are omitted so the renderer can fall back to their alt text.
 */
export async function resolveDocxImages(urls: string[]): Promise<DocxImageMap> {
  const unique = [...new Set(urls.filter(isHttpUrl))].slice(0, MAX_IMAGES);
  const map: DocxImageMap = new Map();

  await Promise.all(
    unique.map(async (url) => {
      const resolved = await fetchAndDecode(url);
      if (resolved) {
        map.set(url, resolved);
      }
    })
  );

  return map;
}
