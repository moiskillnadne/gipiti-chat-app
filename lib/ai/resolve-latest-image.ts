import type { ChatMessage } from "@/lib/types";

const IMAGE_MEDIA_TYPE_PREFIX = "image/";

/**
 * Find the URL of the most recent image in a conversation, scanning
 * newest→oldest. Resolves an image from any of the three ways one can enter the
 * history:
 *  - a `file` attachment the user uploaded (mediaType `image/*`)
 *  - an image produced by the `generateImage` tool (text-chat path)
 *  - an image produced by a direct image model (`data-mediaGeneration`)
 *
 * Callers use this as "the image the user is referring to right now" to power
 * edit/refine flows. Returns undefined when the conversation has no image.
 */
export function resolveLatestImageUrl(
  messages: ChatMessage[]
): string | undefined {
  for (const message of [...messages].reverse()) {
    for (const part of [...message.parts].reverse()) {
      if (
        part.type === "file" &&
        part.mediaType?.startsWith(IMAGE_MEDIA_TYPE_PREFIX)
      ) {
        return part.url;
      }

      if (
        part.type === "tool-generateImage" &&
        part.state === "output-available" &&
        part.output?.imageUrl
      ) {
        return part.output.imageUrl;
      }

      if (
        part.type === "data-mediaGeneration" &&
        part.data.status === "done" &&
        part.data.mediaType === "image" &&
        part.data.url
      ) {
        return part.data.url;
      }
    }
  }

  return;
}
