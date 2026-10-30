"use client";

import { StopIcon } from "@/components/icons";
import { useTranslations } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import { FROSTED } from "./media-preview-styles";

type MediaStopButtonProps = {
  onStop: () => void;
};

/** Frosted pill pinned to the bottom of a generating media card. */
export const MediaStopButton = ({ onStop }: MediaStopButtonProps) => {
  const t = useTranslations("chat.media");
  return (
    <button
      aria-label={t("stopGeneration")}
      className={cn(
        "-translate-x-1/2 absolute bottom-3.5 left-1/2 inline-flex items-center gap-1.5 rounded-pill px-3.5 py-2 font-medium text-[12.5px] text-ink transition-colors duration-fast ease-canon hover:bg-white/95",
        FROSTED
      )}
      data-testid="media-stop-button"
      onClick={onStop}
      title={t("stopGeneration")}
      type="button"
    >
      <StopIcon size={11} />
      {t("stop")}
    </button>
  );
};
