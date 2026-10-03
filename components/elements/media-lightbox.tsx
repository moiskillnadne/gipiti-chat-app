"use client";

import { type ReactNode, useRef } from "react";
import Lightbox, {
  type Labels,
  type Plugin,
  type Slide,
  type ZoomRef,
} from "yet-another-react-lightbox";
import Captions from "yet-another-react-lightbox/plugins/captions";
import Counter from "yet-another-react-lightbox/plugins/counter";
import Download from "yet-another-react-lightbox/plugins/download";
import Video from "yet-another-react-lightbox/plugins/video";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";
import "yet-another-react-lightbox/plugins/counter.css";

import { useDoubleClickZoomToggle } from "@/hooks/use-double-click-zoom-toggle";
import { getModelById } from "@/lib/ai/models";
import { type TranslateFn, useTranslations } from "@/lib/i18n/translate";
import { parseAspectRatio } from "@/lib/media/aspect-ratio";
import type { ChatMediaItem } from "@/lib/media/collect-chat-media";

export type MediaLightboxProps = {
  items: readonly ChatMediaItem[];
  /** Slide shown when the lightbox opens. */
  index: number;
  isOpen: boolean;
  onClose: () => void;
  onDownload: (item: ChatMediaItem) => void;
};

/** Fallback video box when the generation carries no aspect token. */
const DEFAULT_VIDEO_DIMENSIONS = { width: 1280, height: 720 };
const VIDEO_BASE_WIDTH = 1280;

/**
 * Zoom tuning. YARL caps zoom at `maxZoomPixelRatio` image pixels per physical
 * pixel; the default (1) disables zoom entirely for ~1024px generated images on
 * retina screens, because the fitted image already exceeds that ratio.
 */
const ZOOM_SETTINGS = {
  maxZoomPixelRatio: 4,
  zoomInMultiplier: 2,
  scrollToZoom: true,
  // Zero delays disable the built-in double-click zoom (it jumps straight to
  // max zoom); useDoubleClickZoomToggle implements a strict 1x ↔ 2x toggle.
  doubleClickDelay: 0,
  doubleTapDelay: 0,
} as const;

/**
 * Checkerboard behind image slides. Transparent images (e.g. a dark logo PNG)
 * are otherwise invisible on the black backdrop; opaque images cover it fully.
 */
const CAROUSEL_SETTINGS = {
  finite: true,
  padding: "16px",
  imageProps: {
    style: {
      backgroundColor: "#ffffff",
      backgroundImage:
        "repeating-conic-gradient(#e4e4e7 0% 25%, transparent 0% 50%)",
      backgroundSize: "16px 16px",
    },
  },
} as const;

const captionDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
});

const formatCaptionDate = (createdAt?: string): string | undefined => {
  if (!createdAt) {
    return;
  }
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime())
    ? undefined
    : captionDateFormatter.format(date);
};

const videoDimensions = (aspectRatio?: string) => {
  const ratio = parseAspectRatio(aspectRatio);
  if (!ratio) {
    return DEFAULT_VIDEO_DIMENSIONS;
  }
  return {
    width: VIDEO_BASE_WIDTH,
    height: Math.round((VIDEO_BASE_WIDTH * ratio.height) / ratio.width),
  };
};

const buildDescription = (
  prompt?: string,
  dateLabel?: string
): ReactNode | undefined => {
  if (!(prompt || dateLabel)) {
    return;
  }
  return (
    <>
      {prompt && <span className="block">{prompt}</span>}
      {dateLabel && (
        <span className="mt-1 block font-mono text-[11px] text-white/60 uppercase tracking-[0.05em]">
          {dateLabel}
        </span>
      )}
    </>
  );
};

const buildSlide = (
  item: ChatMediaItem,
  resolveModelLabel: (modelId?: string) => string | undefined
): Slide => {
  const caption = {
    title: resolveModelLabel(item.modelId),
    description: buildDescription(
      item.prompt,
      formatCaptionDate(item.createdAt)
    ),
  };

  if (item.mediaType === "video") {
    return {
      type: "video",
      sources: [{ src: item.url, type: "video/mp4" }],
      ...videoDimensions(item.aspectRatio),
      ...caption,
    };
  }

  return { src: item.url, alt: item.prompt ?? "", ...caption };
};

const buildLabels = (t: TranslateFn): Labels => ({
  Lightbox: t("lightbox"),
  "Photo gallery": t("gallery"),
  Carousel: t("carousel"),
  Slide: t("slide"),
  // Keep YARL's own placeholders intact through our ICU-style formatter.
  "{index} of {total}": t("slidePosition", {
    index: "{index}",
    total: "{total}",
  }),
  Previous: t("previous"),
  Next: t("next"),
  Close: t("close"),
  "Zoom in": t("zoomIn"),
  "Zoom out": t("zoomOut"),
  Download: t("download"),
  Caption: t("caption"),
  "Show captions": t("showCaptions"),
  "Hide captions": t("hideCaptions"),
});

const hideNavigation = {
  buttonPrev: () => null,
  buttonNext: () => null,
};

/**
 * Fullscreen media viewer: zoom (wheel, pinch, double-click, +/−), drag-pan,
 * keyboard / swipe navigation, download and captions. Videos play inline.
 * Presentational — the caller owns the gallery items and open state.
 */
export const MediaLightbox = ({
  items,
  index,
  isOpen,
  onClose,
  onDownload,
}: MediaLightboxProps) => {
  const t = useTranslations("chat.media.lightbox");
  const tModels = useTranslations("modelList");
  const zoomRef = useRef<ZoomRef>(null);
  useDoubleClickZoomToggle(zoomRef, isOpen);

  // A missing translation returns the key itself (contains "."), so the
  // caption title is hidden in that case — same rule as the media card chip.
  const resolveModelLabel = (modelId?: string): string | undefined => {
    const model = modelId ? getModelById(modelId) : undefined;
    if (!model) {
      return;
    }
    const label = tModels(model.name);
    return label.includes(".") ? undefined : label;
  };
  const slides = items.map((item) => buildSlide(item, resolveModelLabel));

  const isGallery = items.length > 1;
  const plugins: Plugin[] = isGallery
    ? [Zoom, Download, Captions, Video, Counter]
    : [Zoom, Download, Captions, Video];

  return (
    <Lightbox
      captions={{ descriptionMaxLines: 4, descriptionTextAlign: "start" }}
      carousel={CAROUSEL_SETTINGS}
      close={onClose}
      controller={{ closeOnBackdropClick: true }}
      download={{
        download: ({ slide }) => {
          const item = items[slides.indexOf(slide)];
          if (item) {
            onDownload(item);
          }
        },
      }}
      index={index}
      labels={buildLabels(t)}
      open={isOpen}
      plugins={plugins}
      render={isGallery ? undefined : hideNavigation}
      slides={slides}
      video={{ autoPlay: true, controls: true, playsInline: true }}
      zoom={{ ...ZOOM_SETTINGS, ref: zoomRef }}
    />
  );
};
