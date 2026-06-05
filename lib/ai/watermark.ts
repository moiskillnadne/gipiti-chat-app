import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

/**
 * Filesystem path of the watermark logo. Bundled into the chat function via
 * `outputFileTracingIncludes` in next.config.ts so it resolves at runtime.
 */
const WATERMARK_LOGO_PATH = join(
  process.cwd(),
  "public",
  "icons",
  "icon-256.png"
);

/** Logo width as a fraction of the base image width. */
const LOGO_WIDTH_RATIO = 0.18;
const MIN_LOGO_WIDTH = 48;
const MAX_LOGO_WIDTH = 512;

/** Corner padding as a fraction of the base image width. */
const LOGO_PADDING_RATIO = 0.03;

/** Logo opacity (0–1) applied to the watermark before compositing. */
const LOGO_OPACITY = 0.55;
const MAX_ALPHA = 255;

/**
 * Module-level cache for the fetched logo bytes. The watermark asset is static,
 * so we fetch it once per server instance.
 */
let cachedLogoBuffer: Buffer | null = null;

/**
 * Read the watermark logo from the filesystem once per server instance.
 */
async function loadLogoBuffer(): Promise<Buffer> {
  if (cachedLogoBuffer) {
    return cachedLogoBuffer;
  }

  cachedLogoBuffer = await readFile(WATERMARK_LOGO_PATH);
  return cachedLogoBuffer;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/**
 * Build a logo sized to the base image with reduced opacity. Opacity is applied
 * by multiplying the alpha channel via a tiled `dest-in` composite.
 */
async function buildWatermarkOverlay(
  logoBuffer: Buffer,
  imageWidth: number
): Promise<Buffer> {
  const logoWidth = clamp(
    Math.round(imageWidth * LOGO_WIDTH_RATIO),
    MIN_LOGO_WIDTH,
    MAX_LOGO_WIDTH
  );
  const opacityAlpha = Math.round(MAX_ALPHA * LOGO_OPACITY);

  return await sharp(logoBuffer)
    .resize({ width: logoWidth })
    .ensureAlpha()
    .composite([
      {
        input: Buffer.from([MAX_ALPHA, MAX_ALPHA, MAX_ALPHA, opacityAlpha]),
        raw: { width: 1, height: 1, channels: 4 },
        tile: true,
        blend: "dest-in",
      },
    ])
    .png()
    .toBuffer();
}

/**
 * Composite the app logo as a semi-transparent watermark onto the bottom-right
 * corner of a generated image. The output format matches the input (sharp
 * preserves it when no format is forced).
 *
 * Fails safe: on any error the original buffer is returned unchanged so that
 * watermarking never breaks image generation.
 */
export async function applyImageWatermark(
  imageBuffer: Buffer
): Promise<Buffer> {
  try {
    const baseImage = sharp(imageBuffer);
    const { width, height } = await baseImage.metadata();
    if (!(width && height)) {
      return imageBuffer;
    }

    const logoBuffer = await loadLogoBuffer();
    const overlay = await buildWatermarkOverlay(logoBuffer, width);
    const overlayMeta = await sharp(overlay).metadata();
    const overlayWidth = overlayMeta.width ?? 0;
    const overlayHeight = overlayMeta.height ?? 0;

    const padding = Math.round(width * LOGO_PADDING_RATIO);
    const left = Math.max(width - overlayWidth - padding, 0);
    const top = Math.max(height - overlayHeight - padding, 0);

    return await baseImage
      .composite([{ input: overlay, top, left }])
      .toBuffer();
  } catch (error) {
    console.error(
      "Failed to apply image watermark; using original image",
      error
    );
    return imageBuffer;
  }
}
