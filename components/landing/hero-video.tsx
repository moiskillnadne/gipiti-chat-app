"use client";

import { useEffect, useRef } from "react";

import {
  HERO_POSTER_SRC,
  HERO_VIDEO_SRC,
  shouldPlayHeroVideo,
} from "@/lib/marketing/hero-media";

/** `navigator.connection` (Network Information API) is not in lib.dom yet. */
type NavigatorWithConnection = Navigator & {
  connection?: { saveData?: boolean };
};

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Decorative hero background.
 *
 * Server-rendered as the poster only: no `src`/`<source>` and `preload="none"`,
 * so the video never competes with JS, CSS and fonts during the critical
 * window. (An `autoplay` attribute would not do — browsers ignore `preload`
 * for autoplaying media.) Playback is attached after the window `load` event,
 * and skipped for reduced-motion and Save-Data users, who keep the poster.
 */
export const HeroVideo = () => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const { connection } = navigator as NavigatorWithConnection;
    const isPlaybackWanted = shouldPlayHeroVideo({
      prefersReducedMotion: window.matchMedia(REDUCED_MOTION_QUERY).matches,
      hasSaveData: connection?.saveData === true,
    });
    if (!isPlaybackWanted) {
      return;
    }

    const startPlayback = () => {
      video.src = HERO_VIDEO_SRC;
      // A muted, inline video may autoplay without a gesture; the promise still
      // rejects under some power-saving modes, in which case the poster stays.
      video.play().catch(() => {
        // Intentionally ignored: the poster stays in place.
      });
    };

    if (document.readyState === "complete") {
      startPlayback();
      return;
    }
    window.addEventListener("load", startPlayback, { once: true });
    return () => window.removeEventListener("load", startPlayback);
  }, []);

  return (
    <video
      className="absolute inset-0 size-full object-cover"
      loop
      muted
      playsInline
      poster={HERO_POSTER_SRC}
      preload="none"
      ref={videoRef}
    />
  );
};
