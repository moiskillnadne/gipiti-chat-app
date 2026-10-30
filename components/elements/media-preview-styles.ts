import type { CSSProperties } from "react";

/** Card sizing derived from the chosen format (square fallback). */
export type CardShape = {
  /** Inline style overriding the default aspect-square media area. */
  mediaStyle?: CSSProperties;
  /** True for portrait formats — the card narrows to limit its height. */
  isPortrait: boolean;
};

export const CARD_FRAME =
  "relative w-full max-w-[392px] overflow-hidden rounded-lg border border-rule bg-card shadow-md";
// Portrait formats narrow the card so tall ratios don't dominate the thread.
export const CARD_FRAME_PORTRAIT = "max-w-[294px]";
export const MEDIA_AREA =
  "relative aspect-square w-full overflow-hidden bg-paper-2";
export const FROSTED =
  "bg-white/75 shadow-[inset_0_0_0_1px_rgba(255,255,255,.7),0_1px_4px_rgba(20,22,26,.12)] backdrop-blur-md backdrop-saturate-150";
