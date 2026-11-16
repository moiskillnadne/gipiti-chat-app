import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai/remote-image-fetch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai/remote-image-fetch")>()),
  fetchPublicImageBytes: vi.fn(),
}));

import {
  fetchPublicImageBytes,
  RemoteImageFetchError,
  type RemoteImageFetchOptions,
} from "@/lib/ai/remote-image-fetch";

import {
  loadDocumentImages,
  MAX_CONCURRENT_IMAGE_LOADS,
  MAX_DOCUMENT_IMAGES,
} from "../document-images";
import { resolveDocxImages } from "../docx-images";
import { resolvePdfImages } from "../pdf-images";

const MAX_DIMENSION = 1600;
const CHANNELS = 3;
const BLUE = { r: 20, g: 60, b: 200 };

const SMALL_PNG_URL = "https://images.test/small.png";
const SMALL_JPEG_URL = "https://images.test/small.jpg";
const SMALL_WEBP_URL = "https://images.test/small.webp";
const LARGE_PNG_URL = "https://images.test/large.png";
const BROKEN_URL = "https://images.test/broken.png";
const MISSING_URL = "https://images.test/missing.png";
const DATA_URL = "data:image/png;base64,AAAA";
const PLAIN_HTTP_URL = "http://images.test/small.png";
const METADATA_URL = "https://169.254.169.254/latest/meta-data/";
const LOCALHOST_URL = "https://localhost/small.png";
const REFUSED_URLS = [DATA_URL, PLAIN_HTTP_URL, METADATA_URL, LOCALHOST_URL];

type ImageFormat = "png" | "jpeg" | "webp";

const createImage = async (
  format: ImageFormat,
  width: number,
  height: number
): Promise<Buffer> => {
  const image = sharp({
    create: { width, height, channels: CHANNELS, background: BLUE },
  });
  if (format === "png") {
    return await image.png().toBuffer();
  }
  if (format === "jpeg") {
    return await image.jpeg().toBuffer();
  }
  return await image.webp().toBuffer();
};

const decodeDataUri = (
  dataUri: string
): { mimeType: string; bytes: Buffer } => {
  const [header, payload] = dataUri.split(",");
  return {
    mimeType: header.replace("data:", "").replace(";base64", ""),
    bytes: Buffer.from(payload, "base64"),
  };
};

const numberedUrl = (index: number): string =>
  `https://images.test/numbered-${index}.png`;

const fetchedUrls = (): string[] =>
  vi.mocked(fetchPublicImageBytes).mock.calls.map(([url]) => url);

describe("document image embedding", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;
  let consoleWarn: ReturnType<typeof vi.spyOn>;
  let smallPng: Buffer;

  beforeEach(async () => {
    smallPng = await createImage("png", 320, 200);
    const imagesByUrl = new Map<string, Buffer>([
      [SMALL_PNG_URL, smallPng],
      [SMALL_JPEG_URL, await createImage("jpeg", 320, 200)],
      [SMALL_WEBP_URL, await createImage("webp", 320, 200)],
      [LARGE_PNG_URL, await createImage("png", 3200, 1600)],
      [BROKEN_URL, Buffer.from("this is not an image")],
    ]);

    vi.mocked(fetchPublicImageBytes).mockImplementation(
      (url: string): Promise<Uint8Array> => {
        const bytes = imagesByUrl.get(url);
        return bytes
          ? Promise.resolve(new Uint8Array(bytes))
          : Promise.reject(
              new RemoteImageFetchError(
                "http_error",
                "Image download failed with status 404"
              )
            );
      }
    );
    consoleError = vi.spyOn(console, "error").mockImplementation(vi.fn());
    consoleWarn = vi.spyOn(console, "warn").mockImplementation(vi.fn());
  });

  afterEach(() => {
    vi.mocked(fetchPublicImageBytes).mockReset();
    consoleError.mockRestore();
    consoleWarn.mockRestore();
  });

  describe("resolvePdfImages", () => {
    it("keeps JPEG as JPEG and converts other formats to PNG", async () => {
      // Act
      const images = await resolvePdfImages([
        SMALL_PNG_URL,
        SMALL_JPEG_URL,
        SMALL_WEBP_URL,
      ]);

      // Assert
      const formats = await Promise.all(
        [SMALL_PNG_URL, SMALL_JPEG_URL, SMALL_WEBP_URL].map(async (url) => {
          const { mimeType, bytes } = decodeDataUri(
            images.get(url)?.dataUri ?? ""
          );
          const metadata = await sharp(bytes).metadata();
          return { mimeType, format: metadata.format, width: metadata.width };
        })
      );
      expect(formats).toEqual([
        { mimeType: "image/png", format: "png", width: 320 },
        { mimeType: "image/jpeg", format: "jpeg", width: 320 },
        { mimeType: "image/png", format: "png", width: 320 },
      ]);
    });

    it("downscales an oversized image to fit the maximum dimension", async () => {
      // Act
      const images = await resolvePdfImages([LARGE_PNG_URL]);

      // Assert
      const { bytes } = decodeDataUri(images.get(LARGE_PNG_URL)?.dataUri ?? "");
      const metadata = await sharp(bytes).metadata();
      expect(metadata.width).toBe(MAX_DIMENSION);
      expect(metadata.height).toBe(MAX_DIMENSION / 2);
    });

    it("omits images that cannot be fetched or decoded, or that the fetch policy refuses", async () => {
      // Act
      const images = await resolvePdfImages([
        BROKEN_URL,
        MISSING_URL,
        ...REFUSED_URLS,
        SMALL_PNG_URL,
      ]);

      // Assert
      expect([...images.keys()]).toEqual([SMALL_PNG_URL]);
      expect(fetchedUrls()).toEqual([BROKEN_URL, MISSING_URL, SMALL_PNG_URL]);
    });
  });

  describe("resolveDocxImages", () => {
    it("returns the encoded bytes with their pixel size and docx image type", async () => {
      // Act
      const images = await resolveDocxImages([
        SMALL_PNG_URL,
        SMALL_JPEG_URL,
        SMALL_WEBP_URL,
      ]);

      // Assert
      const summaries = await Promise.all(
        [SMALL_PNG_URL, SMALL_JPEG_URL, SMALL_WEBP_URL].map(async (url) => {
          const image = images.get(url);
          const metadata = await sharp(image?.data).metadata();
          return {
            type: image?.type,
            width: image?.width,
            height: image?.height,
            encodedFormat: metadata.format,
          };
        })
      );
      expect(summaries).toEqual([
        { type: "png", width: 320, height: 200, encodedFormat: "png" },
        { type: "jpg", width: 320, height: 200, encodedFormat: "jpeg" },
        { type: "png", width: 320, height: 200, encodedFormat: "png" },
      ]);
    });

    it("reports the downscaled size of an oversized image", async () => {
      // Act
      const images = await resolveDocxImages([LARGE_PNG_URL]);

      // Assert
      const image = images.get(LARGE_PNG_URL);
      expect(image?.width).toBe(MAX_DIMENSION);
      expect(image?.height).toBe(MAX_DIMENSION / 2);
    });

    it("omits images that cannot be fetched or decoded, or that the fetch policy refuses", async () => {
      // Act
      const images = await resolveDocxImages([
        BROKEN_URL,
        MISSING_URL,
        ...REFUSED_URLS,
        SMALL_JPEG_URL,
      ]);

      // Assert
      expect([...images.keys()]).toEqual([SMALL_JPEG_URL]);
      expect(fetchedUrls()).toEqual([BROKEN_URL, MISSING_URL, SMALL_JPEG_URL]);
    });
  });

  describe("loadDocumentImages", () => {
    it("fetches each URL once and stops at the image cap", async () => {
      // Arrange
      const urls = Array.from({ length: MAX_DOCUMENT_IMAGES + 5 }, (_, index) =>
        numberedUrl(index)
      );
      vi.mocked(fetchPublicImageBytes).mockResolvedValue(
        new Uint8Array(smallPng)
      );

      // Act
      const images = await loadDocumentImages([...urls, ...urls]);

      // Assert
      const expectedUrls = urls.slice(0, MAX_DOCUMENT_IMAGES);
      expect(fetchedUrls()).toEqual(expectedUrls);
      expect([...images.keys()]).toEqual(expectedUrls);
    });

    it("does not let refused URLs use up the image cap", async () => {
      // Arrange
      const refusedUrls = Array.from(
        { length: MAX_DOCUMENT_IMAGES },
        (_, index) => `http://images.test/plain-${index}.png`
      );

      // Act
      const images = await loadDocumentImages([...refusedUrls, SMALL_PNG_URL]);

      // Assert
      expect([...images.keys()]).toEqual([SMALL_PNG_URL]);
      expect(consoleWarn).toHaveBeenCalledWith(expect.any(String), {
        refusedCount: MAX_DOCUMENT_IMAGES,
        requestedCount: MAX_DOCUMENT_IMAGES + 1,
      });
    });

    it("downloads at most four images at a time", async () => {
      // Arrange
      const urls = Array.from({ length: 12 }, (_, index) => numberedUrl(index));
      let activeDownloads = 0;
      let mostActiveDownloads = 0;
      vi.mocked(fetchPublicImageBytes).mockImplementation(async () => {
        activeDownloads += 1;
        mostActiveDownloads = Math.max(mostActiveDownloads, activeDownloads);
        await new Promise((resolve) => setTimeout(resolve, 5));
        activeDownloads -= 1;
        return new Uint8Array(smallPng);
      });

      // Act
      const images = await loadDocumentImages(urls);

      // Assert
      expect(mostActiveDownloads).toBe(MAX_CONCURRENT_IMAGE_LOADS);
      expect([...images.keys()]).toEqual(urls);
    });

    it("leaves out images that are not loaded by the batch deadline", async () => {
      // Arrange
      const urls = Array.from({ length: 10 }, (_, index) => numberedUrl(index));
      const [promptUrl] = urls;
      // The first image arrives at once; every other download hangs until
      // the batch signal fires, as a stalled server would.
      vi.mocked(fetchPublicImageBytes).mockImplementation(
        (url: string, options?: RemoteImageFetchOptions) =>
          url === promptUrl
            ? Promise.resolve(new Uint8Array(smallPng))
            : new Promise<Uint8Array>((_resolve, reject) => {
                options?.signal?.addEventListener("abort", () =>
                  reject(options.signal?.reason)
                );
              })
      );

      // Act
      const images = await loadDocumentImages(urls, { deadlineMs: 40 });

      // Assert
      expect([...images.keys()]).toEqual([promptUrl]);
      // One slot was freed by the prompt image, so five downloads started;
      // the rest were never attempted once the deadline had passed.
      expect(fetchedUrls()).toEqual(urls.slice(0, 5));
    });
  });
});
