import type { ChatMessage } from "@/lib/types";

export type ChatMediaType = "image" | "video";

/** One viewable media item (image or video) shown in the chat lightbox. */
export type ChatMediaItem = {
  /** Stable identity — the media URL (gallery items are deduped by URL). */
  key: string;
  url: string;
  mediaType: ChatMediaType;
  /** Generation prompt, or the filename for user-uploaded attachments. */
  prompt?: string;
  /** Registry model id of the generating model, when known. */
  modelId?: string;
  /** ISO timestamp of the message the media belongs to. */
  createdAt?: string;
  /** Chosen format as a "W:H" token (generated media only). */
  aspectRatio?: string;
};

type ChatMessagePart = ChatMessage["parts"][number];

type MediaItemContext = {
  role: ChatMessage["role"];
  createdAt?: string;
};

const IMAGE_MEDIA_TYPE_PREFIX = "image/";

const buildItem = (
  url: string,
  mediaType: ChatMediaType,
  context: MediaItemContext,
  details: Pick<ChatMediaItem, "prompt" | "modelId" | "aspectRatio"> = {}
): ChatMediaItem => ({
  key: url,
  url,
  mediaType,
  createdAt: context.createdAt,
  ...details,
});

/**
 * Map one message part to a viewable media item, or null when the part holds
 * no finished image/video.
 *
 * Assistant `file` parts are skipped on purpose: the dedicated image/video
 * handlers persist the generated URL both as a `data-mediaGeneration` part and
 * as an assistant file part, so counting both would show every result twice.
 */
const mediaItemFromPart = (
  part: ChatMessagePart,
  context: MediaItemContext
): ChatMediaItem | null => {
  switch (part.type) {
    case "file": {
      const isUserImage =
        context.role === "user" &&
        part.mediaType.startsWith(IMAGE_MEDIA_TYPE_PREFIX);
      return isUserImage
        ? buildItem(part.url, "image", context, { prompt: part.filename })
        : null;
    }
    case "tool-generateImage": {
      const imageUrl =
        part.state === "output-available" ? part.output?.imageUrl : undefined;
      // input.modelId is chosen by the chat model, not the image model that
      // actually ran, so it is not surfaced as a caption.
      return imageUrl
        ? buildItem(imageUrl, "image", context, { prompt: part.input?.prompt })
        : null;
    }
    case "data-mediaGeneration": {
      const { status, url, mediaType, prompt, modelId, aspectRatio } =
        part.data;
      return status === "done" && url
        ? buildItem(url, mediaType, context, { prompt, modelId, aspectRatio })
        : null;
    }
    case "data-imageGenerationFinish": {
      const { imageUrl, userPrompt } = part.data;
      return imageUrl
        ? buildItem(imageUrl, "image", context, { prompt: userPrompt })
        : null;
    }
    case "data-videoGenerationFinish": {
      const { videoUrl, userPrompt } = part.data;
      return videoUrl
        ? buildItem(videoUrl, "video", context, { prompt: userPrompt })
        : null;
    }
    default:
      return null;
  }
};

/**
 * Collect every finished image/video in a chat, in message and part order, as
 * the gallery the lightbox navigates through. Items are deduped by URL.
 */
export const collectChatMedia = (
  messages: readonly ChatMessage[]
): ChatMediaItem[] => {
  const seenUrls = new Set<string>();
  const items: ChatMediaItem[] = [];

  for (const message of messages) {
    const context: MediaItemContext = {
      role: message.role,
      createdAt: message.metadata?.createdAt,
    };

    for (const part of message.parts ?? []) {
      const item = mediaItemFromPart(part, context);
      if (!item || seenUrls.has(item.url)) {
        continue;
      }
      seenUrls.add(item.url);
      items.push(item);
    }
  }

  return items;
};
