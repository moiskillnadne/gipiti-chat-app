import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  HERO_POSTER_SRC,
  HERO_VIDEO_SRC,
  shouldPlayHeroVideo,
} from "../hero-media";

/** `/videos/hero/<name>.<8 hex sha256 chars>.<ext>` — see scripts/encode-hero-video.sh */
const HASHED_HERO_ASSET =
  /^\/videos\/hero\/[a-z0-9-]+\.([a-f0-9]{8})\.(?:mp4|webp)$/;

/** Mobile budget: the previous 3.4 MB source was fetched in full on every cold visit. */
const MAX_VIDEO_BYTES = 800_000;
const MAX_POSTER_BYTES = 60_000;

const publicFile = (publicPath: string): string =>
  join(process.cwd(), "public", publicPath);

const shortHashOf = (publicPath: string): string =>
  createHash("sha256")
    .update(readFileSync(publicFile(publicPath)))
    .digest("hex")
    .slice(0, 8);

describe("hero media assets", () => {
  it.each([
    ["video", HERO_VIDEO_SRC],
    ["poster", HERO_POSTER_SRC],
  ])(
    "%s path carries the content hash of the file it points to",
    (_label, src) => {
      // `/videos/hero/*` is cached immutably for a year, so a constant left
      // pointing at a stale name would pin every returning visitor to the old
      // file — or 404 once the old file is gone.
      const match = src.match(HASHED_HERO_ASSET);

      expect(match).not.toBeNull();
      expect(shortHashOf(src)).toBe(match?.[1]);
    }
  );

  it("keeps the video and poster within the mobile byte budget", () => {
    expect(statSync(publicFile(HERO_VIDEO_SRC)).size).toBeLessThan(
      MAX_VIDEO_BYTES
    );
    expect(statSync(publicFile(HERO_POSTER_SRC)).size).toBeLessThan(
      MAX_POSTER_BYTES
    );
  });
});

describe("shouldPlayHeroVideo", () => {
  it("plays for a default visitor", () => {
    expect(
      shouldPlayHeroVideo({ prefersReducedMotion: false, hasSaveData: false })
    ).toBe(true);
  });

  it("keeps the poster when the user prefers reduced motion", () => {
    expect(
      shouldPlayHeroVideo({ prefersReducedMotion: true, hasSaveData: false })
    ).toBe(false);
  });

  it("keeps the poster when Save-Data is on", () => {
    expect(
      shouldPlayHeroVideo({ prefersReducedMotion: false, hasSaveData: true })
    ).toBe(false);
  });
});
