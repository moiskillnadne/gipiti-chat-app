import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import { applyImageWatermark } from "../watermark";

const IMAGE_WIDTH = 800;
const IMAGE_HEIGHT = 600;
const WHITE = { r: 255, g: 255, b: 255 };
const CHANNELS = 3;
const CORNER_SIZE = 40;

type Corner = "top-left" | "bottom-right";

const createSolidImage = async (format: "png" | "jpeg"): Promise<Buffer> => {
  const image = sharp({
    create: {
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT,
      channels: CHANNELS,
      background: WHITE,
    },
  });

  return format === "png"
    ? await image.png().toBuffer()
    : await image.jpeg().toBuffer();
};

/** Darkest channel value inside a region; 255 means the region is still white. */
const darkestValueIn = async (
  imageBuffer: Buffer,
  region: { left: number; top: number; width: number; height: number }
): Promise<number> => {
  const pixels = await sharp(imageBuffer)
    .extract(region)
    .removeAlpha()
    .raw()
    .toBuffer();

  return Math.min(...pixels);
};

const cornerRegion = (corner: Corner) =>
  corner === "top-left"
    ? { left: 0, top: 0, width: CORNER_SIZE, height: CORNER_SIZE }
    : {
        // Where the logo sits: 18% of the width wide, padded 3% from the edges.
        left: Math.round(IMAGE_WIDTH * 0.8),
        top: Math.round(IMAGE_HEIGHT * 0.75),
        width: Math.round(IMAGE_WIDTH * 0.15),
        height: Math.round(IMAGE_HEIGHT * 0.2),
      };

describe("applyImageWatermark", () => {
  it.each(["png", "jpeg"] as const)(
    "keeps the %s format and dimensions and draws the logo in the bottom-right corner",
    async (format) => {
      // Arrange
      const original = await createSolidImage(format);

      // Act
      const watermarked = await applyImageWatermark(original);

      // Assert
      const metadata = await sharp(watermarked).metadata();
      expect(metadata.format).toBe(format);
      expect(metadata.width).toBe(IMAGE_WIDTH);
      expect(metadata.height).toBe(IMAGE_HEIGHT);

      const logoCorner = await darkestValueIn(
        watermarked,
        cornerRegion("bottom-right")
      );
      const untouchedCorner = await darkestValueIn(
        watermarked,
        cornerRegion("top-left")
      );
      expect(logoCorner).toBeLessThan(250);
      expect(untouchedCorner).toBeGreaterThanOrEqual(250);
    }
  );

  it("returns the original buffer when the input is not an image", async () => {
    // Arrange
    const notAnImage = Buffer.from("this is not an image");
    const consoleError = vi.spyOn(console, "error").mockImplementation(vi.fn());

    // Act
    const result = await applyImageWatermark(notAnImage);

    // Assert
    expect(result).toBe(notAnImage);
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });
});
