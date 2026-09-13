/**
 * Landing hero background assets.
 *
 * Filenames carry a content hash because `/videos/hero/*` is served with a
 * one-year immutable `Cache-Control` (next.config.ts). Regenerate both with
 * `bash scripts/encode-hero-video.sh` and paste the printed names here; the
 * unit test in `__tests__/hero-media.test.ts` fails if they drift.
 */
export const HERO_VIDEO_SRC = "/videos/hero/bg-720p.d37992b5.mp4";
export const HERO_POSTER_SRC = "/videos/hero/poster.40c1e7ca.webp";

type HeroVideoPlaybackContext = {
  prefersReducedMotion: boolean;
  hasSaveData: boolean;
};

/**
 * Decorative autoplay is skipped for visitors who asked for less motion or
 * less data; they keep the poster, which is what the first paint shows anyway.
 */
export const shouldPlayHeroVideo = ({
  prefersReducedMotion,
  hasSaveData,
}: HeroVideoPlaybackContext): boolean => !prefersReducedMotion && !hasSaveData;
