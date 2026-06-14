import "server-only";

import { join } from "node:path";
import pdfmake from "pdfmake";
import type { TFontDictionary } from "pdfmake/interfaces";

/**
 * Roboto TTFs (the four faces pdfmake's default "Roboto" family expects). These
 * are bundled into the chat function via `outputFileTracingIncludes` in
 * next.config.ts so they resolve from the filesystem at runtime. The bundled
 * Roboto includes full Cyrillic coverage, which is why we embed it explicitly
 * instead of relying on a standard PDF font (those lack Cyrillic glyphs).
 *
 * pdfmake's Node renderer reads font sources from file paths (it mishandles
 * in-memory Buffers in its URL-resolution step), so the faces are registered as
 * absolute paths rather than Buffers.
 */
const FONT_DIR = join(process.cwd(), "assets", "fonts");

const ROBOTO_FONTS: TFontDictionary = {
  Roboto: {
    normal: join(FONT_DIR, "Roboto-Regular.ttf"),
    bold: join(FONT_DIR, "Roboto-Medium.ttf"),
    italics: join(FONT_DIR, "Roboto-Italic.ttf"),
    bolditalics: join(FONT_DIR, "Roboto-MediumItalic.ttf"),
  },
};

let isConfigured = false;

/**
 * Register the embedded fonts on the pdfmake singleton once per server instance
 * and return the configured instance. Remote resource fetches are blocked (we
 * never embed external assets); local reads are allowed for the bundled fonts.
 */
export function getConfiguredPdfmake(): typeof pdfmake {
  if (!isConfigured) {
    pdfmake.setFonts(ROBOTO_FONTS);
    pdfmake.setUrlAccessPolicy(() => false);
    pdfmake.setLocalAccessPolicy(() => true);
    isConfigured = true;
  }
  return pdfmake;
}
