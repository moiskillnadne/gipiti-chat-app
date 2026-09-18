/**
 * Open Graph share images for the marketing pages.
 *
 * Next.js only attaches the file-based `app/opengraph-image.tsx` card to the
 * root route; every page that declares its own `openGraph` metadata has to
 * list an image explicitly or link previews (Telegram, VK, X) render without
 * one. Image and video landings put their real hero render on the card, the
 * rest fall back to the site-wide card.
 */

import type { ModelLanding } from "@/lib/marketing/model-landings";
import { SITE_URL } from "./site";

export type OpenGraphImage = {
  url: string;
  width: number;
  height: number;
  alt: string;
};

/** The site-wide card rendered by `app/opengraph-image.tsx` (1200×630). */
export const DEFAULT_OG_IMAGE: OpenGraphImage = {
  url: `${SITE_URL}/opengraph-image`,
  width: 1200,
  height: 630,
  alt: "GIPITI - AI-чат с ChatGPT, Gemini, Claude и Grok",
};

/** Hero render of a media landing when it ships one, else the site card. */
export const getLandingOgImage = (landing: ModelLanding): OpenGraphImage => {
  if (landing.kind === "text" || !landing.heroMedia.sample) {
    return DEFAULT_OG_IMAGE;
  }

  const { src, width, height, alt } = landing.heroMedia.sample;
  return { url: `${SITE_URL}${src}`, width, height, alt };
};
