import type { CustomUIDataTypes } from "@/lib/types";
import type { ChatTurnContext, StreamWriter } from "./context";

type MediaGenerationData = CustomUIDataTypes["mediaGeneration"];

/** The `data-mediaGeneration` part as it appears in a message. */
export type MediaGenerationPart = {
  type: "data-mediaGeneration";
  id: string;
  data: MediaGenerationData;
};

/**
 * Media type of the `file` part a handler writes with a finished card. Shared
 * with persisting, which re-creates that part when the snapshot lacks it.
 */
export const MEDIA_FILE_TYPES: Record<
  MediaGenerationData["mediaType"],
  string
> = { image: "image/png", video: "video/mp4" };

/** Fields of the media card that stay the same through the whole lifecycle. */
export type MediaPartBase = Pick<
  MediaGenerationData,
  "documentId" | "mediaType" | "prompt" | "modelId" | "aspectRatio"
>;

/** Fields that only some states carry (url, generationId, errorMessage, ...). */
export type MediaPartExtra = Partial<
  Pick<
    MediaGenerationData,
    "url" | "durationSeconds" | "errorMessage" | "generationId"
  >
>;

/**
 * Build the writer of one media card's lifecycle states. The part `id` is the
 * document id, so every write replaces the previous state of the same card on
 * the client. The part is also kept on the context: when the response was
 * cancelled (no resumable stream) the message snapshot may lag behind the
 * handler, and the persisted card must reflect where the handler really ended.
 */
export function createMediaPartWriter(
  ctx: Pick<ChatTurnContext, "finalMediaPart">,
  writer: StreamWriter,
  base: MediaPartBase
): (status: MediaGenerationData["status"], extra?: MediaPartExtra) => void {
  return (status, extra = {}) => {
    const part: MediaGenerationPart = {
      id: base.documentId,
      type: "data-mediaGeneration",
      data: { ...base, status, ...extra },
    };
    ctx.finalMediaPart = part;
    writer.write(part);
  };
}
