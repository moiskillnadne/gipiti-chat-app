"use client";

import { RefreshCwIcon, StopCircleIcon } from "lucide-react";
import { useTranslations } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import {
  CARD_FRAME,
  CARD_FRAME_PORTRAIT,
  type CardShape,
  MEDIA_AREA,
} from "./media-preview-styles";

type MediaStoppedCardProps = {
  mediaType: "image" | "video";
  shape: CardShape;
  onRegenerate?: () => void;
};

/** Neutral card shown for a turn the user stopped before a result arrived. */
export const MediaStoppedCard = ({
  mediaType,
  shape,
  onRegenerate,
}: MediaStoppedCardProps) => {
  const t = useTranslations("chat.media");
  return (
    <div className={cn(CARD_FRAME, shape.isPortrait && CARD_FRAME_PORTRAIT)}>
      <div
        className={cn(
          MEDIA_AREA,
          "flex flex-col items-center justify-center gap-1.5 px-8 text-center"
        )}
        style={shape.mediaStyle}
      >
        <StopCircleIcon className="mb-1.5 size-[30px] text-ink-3" />
        <div className="font-medium text-[14px] text-ink">
          {t("stoppedTitle")}
        </div>
        <div className="text-[12px] text-ink-3 leading-snug">
          {mediaType === "image" ? t("stoppedImage") : t("stoppedVideo")}
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
