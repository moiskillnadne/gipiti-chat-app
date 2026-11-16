import "server-only";

import sharp from "sharp";

import {
  fetchPublicImageBytes,
  isAllowedRemoteImageUrl,
  RemoteImageFetchError,
  type RemoteImageFetchFailureReason,
} from "./remote-image-fetch";

/**
 * Loads the images a generated document links to, for both the PDF and the
 * DOCX renderer. The URLs are model-written, so every download goes through
 * `fetchPublicImageBytes`, and the batch as a whole is bounded: in how many
 * images it takes, how many it downloads at once and how long it may run.
 */

/** Bound the work/size of image embedding (model-authored content). */
export const MAX_DOCUMENT_IMAGES = 20;
export const MAX_CONCURRENT_IMAGE_LOADS = 4;
/** Total time for all images of one document; later images are left out. */
export const DOCUMENT_IMAGES_DEADLINE_MS = 20_000;

/** Downscale very large images so the document stays a reasonable size. */
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 82;

export type DocumentImageFormat = "png" | "jpeg";

export type DocumentImage = {
  data: Buffer;
  width: number;
  height: number;
  format: DocumentImageFormat;
};

export type DocumentImageMap = Map<string, DocumentImage>;

export type LoadDocumentImagesOptions = {
  /** Override of `DOCUMENT_IMAGES_DEADLINE_MS`. */
  deadlineMs?: number;
};

/**
 * Normalize downloaded bytes through sharp: pdfkit and docx only take PNG and
 * JPEG, so JPEG stays JPEG (to stay small), anything else becomes PNG, and
 * oversized images are downscaled.
 */
const normalizeImage = async (bytes: Uint8Array): Promise<DocumentImage> => {
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
    format: isJpeg ? "jpeg" : "png",
  };
};

/**
 * Why an image was left out: a reason from the fetch policy, "deadline" when
 * the batch ran out of time while the image was downloading, or "unreadable"
 * when the bytes arrived but are not an image sharp can decode.
 */
export type DocumentImageFailureReason =
  | RemoteImageFetchFailureReason
  | "deadline"
  | "unreadable";

const failureReasonOf = (
  error: unknown,
  deadline: AbortSignal
): DocumentImageFailureReason => {
  if (error instanceof RemoteImageFetchError) {
    return error.reason;
  }
  // The fetcher rethrows the caller's abort reason as is, so identity tells
  // a download cut by the deadline from a decode that failed after it.
  const isDeadlineAbort = deadline.aborted && error === deadline.reason;
  return isDeadlineAbort ? "deadline" : "unreadable";
};

/**
 * Download and normalize one image. Returns null on any failure (refused by
 * the fetch policy, unreachable, not an image, past the batch deadline) so
 * the renderer falls back to the image's alt text.
 */
const loadImage = async (
  url: string,
  deadline: AbortSignal
): Promise<DocumentImage | null> => {
  if (deadline.aborted) {
    return null;
  }
  try {
    const bytes = await fetchPublicImageBytes(url, { signal: deadline });
    return await normalizeImage(bytes);
  } catch (error) {
    const reason = failureReasonOf(error, deadline);
    console.error("Failed to load document image", { url, reason }, error);
    return null;
  }
};

/**
 * Map `items` through `mapper`, running at most `limit` calls at a time, and
 * return the results in the order of `items`.
 */
const mapWithConcurrency = async <Item, Result>(
  items: readonly Item[],
  limit: number,
  mapper: (item: Item) => Promise<Result>
): Promise<Result[]> => {
  const results = new Array<Result>(items.length);
  // The runners share one iterator, so each item is taken by exactly one.
  const pendingEntries = items.entries();

  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async (): Promise<void> => {
      for (const [index, item] of pendingEntries) {
        results[index] = await mapper(item);
      }
    }
  );
  await Promise.all(runners);

  return results;
};

/**
 * Resolve the given image URLs to normalized images, keyed by URL. Only URLs
 * the fetch policy allows are tried (deduped, capped at
 * `MAX_DOCUMENT_IMAGES`); an image that cannot be loaded is omitted.
 */
export const loadDocumentImages = async (
  urls: string[],
  options: LoadDocumentImagesOptions = {}
): Promise<DocumentImageMap> => {
  const { deadlineMs = DOCUMENT_IMAGES_DEADLINE_MS } = options;
  const uniqueUrls = [...new Set(urls)];
  const permittedUrls = uniqueUrls.filter(isAllowedRemoteImageUrl);
  const allowedUrls = permittedUrls.slice(0, MAX_DOCUMENT_IMAGES);
  const refusedCount = uniqueUrls.length - permittedUrls.length;
  if (refusedCount > 0) {
    // URLs are left out of the log: they can be data: URIs of any length.
    console.warn("Document image URLs refused by the fetch policy", {
      refusedCount,
      requestedCount: uniqueUrls.length,
    });
  }
  const deadline = AbortSignal.timeout(deadlineMs);

  const images = await mapWithConcurrency(
    allowedUrls,
    MAX_CONCURRENT_IMAGE_LOADS,
    (url) => loadImage(url, deadline)
  );

  const imageMap: DocumentImageMap = new Map();
  for (const [index, image] of images.entries()) {
    if (image) {
      imageMap.set(allowedUrls[index], image);
    }
  }
  return imageMap;
};
