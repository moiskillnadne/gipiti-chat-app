"use client";

import dynamic from "next/dynamic";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { useMediaDownload } from "@/hooks/use-media-download";
import {
  type ChatMediaItem,
  collectChatMedia,
} from "@/lib/media/collect-chat-media";
import type { ChatMessage } from "@/lib/types";

// The lightbox library and its CSS load only on the first open.
const MediaLightbox = dynamic(
  () => import("./media-lightbox").then((module) => module.MediaLightbox),
  { ssr: false }
);

/** Slide data for media that is not part of the chat gallery. */
export type AdHocMediaSlide = Partial<Omit<ChatMediaItem, "url" | "key">>;

type MediaLightboxContextValue = {
  /**
   * Open the lightbox on `url`. Media found in the chat gallery opens there
   * (with navigation); anything else opens alone using `adHocSlide`.
   */
  openMedia: (url: string, adHocSlide?: AdHocMediaSlide) => void;
};

type LightboxGallery = {
  items: ChatMediaItem[];
  index: number;
};

const MediaLightboxContext = createContext<MediaLightboxContextValue | null>(
  null
);

const toAdHocItem = (
  url: string,
  adHocSlide?: AdHocMediaSlide
): ChatMediaItem => ({
  mediaType: "image",
  ...adHocSlide,
  key: url,
  url,
});

/**
 * Owns the chat-wide media gallery and the fullscreen lightbox. Every image or
 * video rendered inside opens through `useMediaLightbox().openMedia(url)`.
 */
export const MediaLightboxProvider = ({
  messages,
  children,
}: {
  messages: readonly ChatMessage[];
  children: ReactNode;
}) => {
  const downloadMedia = useMediaDownload();
  const galleryItems = useMemo(() => collectChatMedia(messages), [messages]);
  // Kept after close so the fade-out animation still has slides to render.
  const [gallery, setGallery] = useState<LightboxGallery | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openMedia = useCallback(
    (url: string, adHocSlide?: AdHocMediaSlide) => {
      const galleryIndex = galleryItems.findIndex((item) => item.url === url);
      setGallery(
        galleryIndex === -1
          ? { items: [toAdHocItem(url, adHocSlide)], index: 0 }
          : { items: galleryItems, index: galleryIndex }
      );
      setIsOpen(true);
    },
    [galleryItems]
  );

  const contextValue = useMemo(() => ({ openMedia }), [openMedia]);

  return (
    <MediaLightboxContext.Provider value={contextValue}>
      {children}
      {gallery && (
        <MediaLightbox
          index={gallery.index}
          isOpen={isOpen}
          items={gallery.items}
          onClose={() => setIsOpen(false)}
          onDownload={(item) => downloadMedia(item.url, item.mediaType)}
        />
      )}
    </MediaLightboxContext.Provider>
  );
};

/**
 * Access the surrounding media lightbox. Returns null outside a
 * `MediaLightboxProvider`, so callers can render media as non-clickable.
 */
export const useMediaLightbox = (): MediaLightboxContextValue | null =>
  useContext(MediaLightboxContext);
