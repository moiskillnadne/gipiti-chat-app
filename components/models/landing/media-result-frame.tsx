import { PlayIcon } from "lucide-react";

import type {
  LandingMediaAspect,
  ModelLandingAccent,
} from "@/lib/marketing/model-landings";

import { accentClasses } from "./accent-styles";
import { EmphasizedText } from "./emphasized-text";

/**
 * Sizing for the hero result frame. A 9:16 frame is capped in width so a
 * portrait mockup does not tower over the hero copy next to it.
 */
export const mediaAspectClasses: Record<LandingMediaAspect, string> = {
  "16:9": "aspect-video",
  "1:1": "aspect-square",
  "9:16": "mx-auto aspect-[9/16] max-w-[58%]",
};

type MediaResultFrameProps = {
  accent: ModelLandingAccent;
  isVideo: boolean;
  /** Scene description laid over the frame; supports `**bold**`. */
  caption: string;
  /** Sizing classes: an aspect ratio in the hero, `flex-1` inside a card. */
  sizeClassName: string;
  captionClassName?: string;
};

/**
 * Stand-in for a generated image or video frame. Deliberately an abstract
 * gradient rather than a sample output — the page ships no generated assets.
 */
export const MediaResultFrame = ({
  accent,
  isVideo,
  caption,
  sizeClassName,
  captionClassName = "text-[12.5px]",
}: MediaResultFrameProps) => (
  <div
    className={`relative overflow-hidden rounded-xl border border-white/10 ${accentClasses[accent].mediaCanvas} ${sizeClassName}`}
  >
    <div
      aria-hidden="true"
      className="absolute inset-0 bg-[radial-gradient(circle_at_28%_22%,rgba(255,255,255,0.35),transparent_58%)]"
    />
    <div
      aria-hidden="true"
      className="absolute inset-0 bg-[radial-gradient(circle_at_80%_78%,rgba(9,9,11,0.5),transparent_62%)]"
    />
    <div
      aria-hidden="true"
      className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-zinc-950/85 to-transparent"
    />

    {isVideo ? (
      <>
        <div
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="flex size-11 items-center justify-center rounded-full border border-white/40 bg-zinc-950/35 pl-0.5 text-white backdrop-blur-[2px]">
            <PlayIcon className="size-4.5 fill-current" />
          </span>
        </div>
        <div
          aria-hidden="true"
          className="absolute inset-x-3 bottom-2.5 h-1 overflow-hidden rounded-full bg-white/25"
        >
          <span className="block h-full w-1/3 rounded-full bg-white/85" />
        </div>
      </>
    ) : null}

    <p
      className={`absolute inset-x-0 bottom-0 px-3.5 text-zinc-100 leading-snug ${isVideo ? "pb-5" : "pb-3"} ${captionClassName}`}
    >
      <EmphasizedText text={caption} />
    </p>
  </div>
);
