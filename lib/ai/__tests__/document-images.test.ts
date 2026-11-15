import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

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

describe("document image embedding", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    const imagesByUrl = new Map<string, Buffer>([
      [SMALL_PNG_URL, await createImage("png", 320, 200)],
      [SMALL_JPEG_URL, await createImage("jpeg", 320, 200)],
      [SMALL_WEBP_URL, await createImage("webp", 320, 200)],
      [LARGE_PNG_URL, await createImage("png", 3200, 1600)],
      [BROKEN_URL, Buffer.from("this is not an image")],
    ]);

    vi.stubGlobal(
      "fetch",
      vi.fn((url: string): Promise<Response> => {
        const bytes = imagesByUrl.get(url);
        return Promise.resolve(
          bytes
            ? new Response(new Uint8Array(bytes))
            : new Response(null, { status: 404 })
        );
      })
    );
    consoleError = vi.spyOn(console, "error").mockImplementation(vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    consoleError.mockRestore();
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

    it("omits images that cannot be fetched, decoded or are not http(s)", async () => {
      // Act
      const images = await resolvePdfImages([
        BROKEN_URL,
        MISSING_URL,
        DATA_URL,
        SMALL_PNG_URL,
      ]);

      // Assert
      expect([...images.keys()]).toEqual([SMALL_PNG_URL]);
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

    it("omits images that cannot be fetched, decoded or are not http(s)", async () => {
      // Act
      const images = await resolveDocxImages([
        BROKEN_URL,
        MISSING_URL,
        DATA_URL,
        SMALL_JPEG_URL,
      ]);

      // Assert
      expect([...images.keys()]).toEqual([SMALL_JPEG_URL]);
    });
  });
});
