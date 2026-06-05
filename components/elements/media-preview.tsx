"use client";

import {
  AlertCircleIcon,
  DownloadIcon,
  ImageIcon,
  Maximize2Icon,
  RefreshCwIcon,
  VideoIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

export type MediaPreviewState = "queued" | "generating" | "done" | "error";
export type MediaPreviewMediaType = "image" | "video";

type MediaPreviewProps = {
  state: MediaPreviewState;
  mediaType: MediaPreviewMediaType;
  prompt?: string;
  url?: string;
  modelLabel?: string;
  durationSeconds?: number;
  dimensions?: string;
  elapsedLabel?: string;
  errorMessage?: string;
  onRegenerate?: () => void;
  onDownload?: () => void;
};

const CARD_FRAME =
  "relative w-full max-w-[392px] overflow-hidden rounded-lg border border-rule bg-card shadow-md";
const MEDIA_AREA = "relative aspect-square w-full overflow-hidden bg-paper-2";
const FROSTED =
  "bg-white/75 shadow-[inset_0_0_0_1px_rgba(255,255,255,.7),0_1px_4px_rgba(20,22,26,.12)] backdrop-blur-md backdrop-saturate-150";

const MediaGlyph = ({
  mediaType,
  className,
}: {
  mediaType: MediaPreviewMediaType;
  className?: string;
}) =>
  mediaType === "image" ? (
    <ImageIcon className={className} />
  ) : (
    <VideoIcon className={className} />
  );

const ModelChip = ({
  mediaType,
  modelLabel,
}: {
  mediaType: MediaPreviewMediaType;
  modelLabel?: string;
}) => {
  if (!modelLabel) {
    return null;
  }
  return (
    <div
      className={cn(
        "absolute top-2.5 left-2.5 inline-flex max-w-[calc(100%-56px)] items-center gap-1.5 overflow-hidden rounded-pill py-[5px] pr-2.5 pl-2 font-medium text-[11px] text-ink",
        FROSTED
      )}
    >
      <MediaGlyph
        className="size-[13px] shrink-0 text-citrus-deep"
        mediaType={mediaType}
      />
      <span className="truncate whitespace-nowrap">{modelLabel}</span>
    </div>
  );
};

const OpenButton = ({
  onOpen,
  label,
}: {
  onOpen: () => void;
  label: string;
}) => (
  <div className="absolute top-2.5 right-2.5 flex gap-1.5">
    <button
      className={cn(
        "flex size-8 items-center justify-center rounded-[9px] text-ink-2 transition-colors duration-fast ease-canon hover:bg-white/95 hover:text-ink",
        FROSTED
      )}
      onClick={onOpen}
      title={label}
      type="button"
    >
      <Maximize2Icon className="size-[15px]" />
    </button>
  </div>
);

const IndeterminateRing = () => (
  <div className="relative size-14">
    <svg
      aria-hidden="true"
      className="size-full animate-spin [animation-duration:1.1s]"
      viewBox="0 0 56 56"
    >
      <circle
        cx="28"
        cy="28"
        fill="none"
        r="24"
        stroke="rgba(20,22,26,.1)"
        strokeWidth="4"
      />
      <circle
        cx="28"
        cy="28"
        fill="none"
        r="24"
        stroke="var(--citrus-deep)"
        strokeDasharray="150.8"
        strokeDashoffset="100"
        strokeLinecap="round"
        strokeWidth="4"
      />
    </svg>
  </div>
);

const GeneratingSkeleton = () => (
  <div className="absolute inset-0 overflow-hidden bg-gradient-to-b from-paper-2 to-paper-3">
    <div
      className="absolute inset-0 opacity-60"
      style={{
        backgroundImage:
          "radial-gradient(rgba(20,22,26,.05) 1px, transparent 1.3px)",
        backgroundSize: "22px 22px",
      }}
    />
    <div
      className="absolute inset-x-[-10%] inset-y-[-40%] animate-media-sweep"
      style={{
        background:
          "linear-gradient(105deg, transparent 38%, rgba(255,255,255,.9) 50%, transparent 62%)",
      }}
    />
  </div>
);

const ActionButtons = ({
  mediaType,
  onRegenerate,
  onDownload,
}: {
  mediaType: MediaPreviewMediaType;
  onRegenerate?: () => void;
  onDownload?: () => void;
}) => {
  const t = useTranslations("chat.media");
  return (
    <div className="flex shrink-0 gap-1.5">
      {onRegenerate && (
        <button
          className="flex size-[34px] items-center justify-center rounded-md border border-rule bg-card text-ink-2 transition-colors duration-fast ease-canon hover:border-rule-strong hover:bg-paper-2 hover:text-ink"
          onClick={onRegenerate}
          title={t("regenerate")}
          type="button"
        >
          <RefreshCwIcon className="size-4" />
        </button>
      )}
      {onDownload && (
        <button
          className="flex size-[34px] items-center justify-center rounded-md border border-ink bg-ink text-paper transition-colors duration-fast ease-canon hover:bg-black"
          onClick={onDownload}
          title={mediaType === "image" ? t("download") : t("downloadVideo")}
          type="button"
        >
          <DownloadIcon className="size-4" />
        </button>
      )}
    </div>
  );
};

const Lightbox = ({
  mediaType,
  url,
  prompt,
  onClose,
}: {
  mediaType: MediaPreviewMediaType;
  url: string;
  prompt?: string;
  onClose: () => void;
}) => {
  const t = useTranslations("chat.media");

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4">
      <button
        aria-label={t("close")}
        className="absolute inset-0 size-full cursor-default"
        onClick={onClose}
        type="button"
      />
      <div className="relative z-[1] flex max-h-full max-w-full items-center justify-center">
        {mediaType === "image" ? (
          // biome-ignore lint/performance/noImgElement: model-generated image, no Next loader
          // biome-ignore lint/nursery/useImageSize: dimensions unknown
          <img
            alt={prompt ?? ""}
            className="max-h-[90vh] max-w-[90vw] rounded-md object-contain"
            src={url}
          />
        ) : (
          // biome-ignore lint/a11y/useMediaCaption: generated video has no captions
          <video
            autoPlay
            className="max-h-[90vh] max-w-[90vw] rounded-md object-contain"
            controls
            playsInline
            src={url}
          />
        )}
        <button
          aria-label={t("close")}
          className="-top-3 -right-3 absolute flex size-9 items-center justify-center rounded-full bg-white text-ink shadow-lg transition-transform hover:scale-105"
          onClick={onClose}
          type="button"
        >
          <XIcon className="size-5" />
        </button>
      </div>
    </div>,
    document.body
  );
};

const QueuedCard = ({ mediaType }: { mediaType: MediaPreviewMediaType }) => {
  const t = useTranslations("chat.media");
  return (
    <div className="flex w-full max-w-[392px] items-center gap-3 rounded-lg border border-rule bg-card p-3.5 shadow-sm">
      <div className="flex size-[38px] shrink-0 items-center justify-center rounded-md bg-paper-2 text-ink-3">
        <MediaGlyph className="size-[18px]" mediaType={mediaType} />
      </div>
      <div className="min-w-0">
        <div className="font-medium text-[13px] text-ink">{t("queued")}</div>
        <div className="mt-[3px] font-mono text-[10px] text-ink-3 uppercase tracking-[0.06em]">
          {mediaType === "image" ? t("queuedImage") : t("queuedVideo")}
        </div>
      </div>
      <div className="ml-auto inline-flex gap-1">
        {[0, 0.2, 0.4].map((delay) => (
          <span
            className="size-[5px] animate-media-blink rounded-full bg-ink-4"
            key={delay}
            style={{ animationDelay: `${delay}s` }}
          />
        ))}
      </div>
    </div>
  );
};

const formatElapsed = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const useElapsedLabel = (overrideLabel?: string): string => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (overrideLabel !== undefined) {
      return;
    }
    const interval = window.setInterval(() => {
      setSeconds((previous) => previous + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [overrideLabel]);

  return overrideLabel ?? formatElapsed(seconds);
};

const GeneratingCard = ({
  mediaType,
  modelLabel,
  elapsedLabel,
}: {
  mediaType: MediaPreviewMediaType;
  modelLabel?: string;
  elapsedLabel?: string;
}) => {
  const t = useTranslations("chat.media");
  const elapsed = useElapsedLabel(elapsedLabel);
  return (
    <div className={CARD_FRAME}>
      <div className={MEDIA_AREA}>
        <GeneratingSkeleton />
        <ModelChip mediaType={mediaType} modelLabel={modelLabel} />
        <div className="absolute top-3.5 right-3.5 font-mono text-[11px] text-ink-3 tracking-[0.04em]">
          {elapsed}
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3.5">
          <IndeterminateRing />
          <div className="text-center font-medium text-[13px] text-ink">
            {mediaType === "image"
              ? t("generatingImage")
              : t("generatingVideo")}
          </div>
        </div>
      </div>
    </div>
  );
};

const ErrorCard = ({
  errorMessage,
  onRegenerate,
}: {
  errorMessage?: string;
  onRegenerate?: () => void;
}) => {
  const t = useTranslations("chat.media");
  return (
    <div className={CARD_FRAME}>
      <div
        className={cn(
          MEDIA_AREA,
          "flex flex-col items-center justify-center gap-1.5 bg-danger-soft px-8 text-center"
        )}
      >
        <AlertCircleIcon className="mb-1.5 size-[30px] text-danger" />
        <div className="font-medium text-[14px] text-ink">
          {t("errorTitle")}
        </div>
        <div className="text-[12px] text-ink-3 leading-snug">
          {errorMessage ?? t("errorTimeout")}
        </div>
        {onRegenerate && (
          <button
            className="mt-3.5 inline-flex items-center gap-1.5 rounded-md border border-rule-strong bg-card px-[15px] py-2 font-medium text-[12.5px] text-ink transition-colors duration-fast ease-canon hover:border-ink"
            onClick={onRegenerate}
            type="button"
          >
            <RefreshCwIcon className="size-3.5" />
            {t("retry")}
          </button>
        )}
      </div>
    </div>
  );
};

const DoneCard = ({
  mediaType,
  url,
  prompt,
  modelLabel,
  metaLabel,
  onRegenerate,
  onDownload,
  onOpen,
}: {
  mediaType: MediaPreviewMediaType;
  url?: string;
  prompt?: string;
  modelLabel?: string;
  metaLabel?: string;
  onRegenerate?: () => void;
  onDownload?: () => void;
  onOpen: () => void;
}) => {
  const t = useTranslations("chat.media");
  return (
    <div className={CARD_FRAME}>
      <div className={MEDIA_AREA}>
        {url ? (
          mediaType === "image" ? (
            // biome-ignore lint/performance/noImgElement: model-generated image, no Next loader
            // biome-ignore lint/nursery/useImageSize: dimensions unknown
            <img
              alt={prompt ?? ""}
              className="size-full object-cover"
              src={url}
            />
          ) : (
            // biome-ignore lint/a11y/useMediaCaption: generated video has no captions
            <video
              className="size-full bg-black object-contain"
              controls
              playsInline
              preload="metadata"
              src={url}
            />
          )
        ) : null}
        <ModelChip mediaType={mediaType} modelLabel={modelLabel} />
        <OpenButton label={t("open")} onOpen={onOpen} />
      </div>
      <div className="flex items-end gap-2.5 border-rule border-t px-3.5 py-3">
        <div className="min-w-0 flex-1">
          {prompt && (
            <div className="line-clamp-2 text-[12.5px] text-ink-2 leading-snug">
              {prompt}
            </div>
          )}
          {metaLabel && (
            <div className="mt-1.5 font-mono text-[10px] text-ink-4 uppercase tracking-[0.05em]">
              {metaLabel}
            </div>
          )}
        </div>
        <ActionButtons
          mediaType={mediaType}
          onDownload={onDownload}
          onRegenerate={onRegenerate}
        />
      </div>
    </div>
  );
};

export const MediaPreview = ({
  state,
  mediaType,
  prompt,
  url,
  modelLabel,
  durationSeconds,
  dimensions,
  elapsedLabel,
  errorMessage,
  onRegenerate,
  onDownload,
}: MediaPreviewProps) => {
  const t = useTranslations("chat.media");
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  if (state === "queued") {
    return <QueuedCard mediaType={mediaType} />;
  }

  if (state === "generating") {
    return (
      <GeneratingCard
        elapsedLabel={elapsedLabel}
        mediaType={mediaType}
        modelLabel={modelLabel}
      />
    );
  }

  if (state === "error") {
    return (
      <ErrorCard errorMessage={errorMessage} onRegenerate={onRegenerate} />
    );
  }

  const metaLabel =
    mediaType === "video"
      ? durationSeconds
        ? t("videoMeta", { seconds: durationSeconds })
        : undefined
      : dimensions;

  return (
    <>
      <DoneCard
        mediaType={mediaType}
        metaLabel={metaLabel}
        modelLabel={modelLabel}
        onDownload={onDownload}
        onOpen={() => setIsLightboxOpen(true)}
        onRegenerate={onRegenerate}
        prompt={prompt}
        url={url}
      />
      {isLightboxOpen && url && (
        <Lightbox
          mediaType={mediaType}
          onClose={() => setIsLightboxOpen(false)}
          prompt={prompt}
          url={url}
        />
      )}
    </>
  );
};
