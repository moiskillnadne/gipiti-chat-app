"use client";

import { useCallback } from "react";
import { toast } from "@/components/toast";
import { downloadFromUrl } from "@/lib/download";
import { useTranslations } from "@/lib/i18n/translate";
import type { ChatMediaType } from "@/lib/media/collect-chat-media";

const FALLBACK_FILENAMES: Record<ChatMediaType, string> = {
  image: "generated-image.png",
  video: "generated-video.mp4",
};

/**
 * Download a generated or attached media file through the browser, surfacing
 * a localized toast when the fetch fails.
 */
export const useMediaDownload = (): ((
  mediaUrl: string,
  mediaType: ChatMediaType
) => Promise<void>) => {
  const t = useTranslations("chat.messages");

  return useCallback(
    async (mediaUrl: string, mediaType: ChatMediaType): Promise<void> => {
      try {
        await downloadFromUrl(mediaUrl, FALLBACK_FILENAMES[mediaType]);
      } catch (error) {
        console.error("Media download failed:", { mediaUrl, error });
        toast({ type: "error", description: t("downloadError") });
      }
    },
    [t]
  );
};
