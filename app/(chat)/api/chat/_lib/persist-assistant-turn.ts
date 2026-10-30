import { ensureMessageHasTextPart } from "@/lib/ai/message-validator";
import { getMessageById } from "@/lib/db/query/chat/get-message-by-id";
import { saveMessages } from "@/lib/db/query/chat/save-messages";
import { updateChatLastContextById } from "@/lib/db/query/chat/update-chat-last-context-by-id";
import {
  finalizeInterruptedMessage,
  finalizeMediaGenerationParts,
} from "@/lib/messages/interrupted";
import type { ChatMessage } from "@/lib/types";
import type { ChatTurnContext } from "./context";
import { MEDIA_FILE_TYPES, type MediaGenerationPart } from "./media-part";
import type { ChatMode } from "./resolve-mode";
import { isTurnSuperseded } from "./turn-superseded";

export type PersistAssistantTurnOptions = {
  /**
   * The user stopped the turn: a text answer is saved partial with the
   * interrupted mark, a media card that was still generating as `stopped`.
   */
  aborted: boolean;
  /** One timestamp for the whole turn, so messages keep their stream order. */
  finishedAt: Date;
};

/**
 * A stopped answer can be saved long after the stop (it waits for a
 * deferred tool and for billing), by which time the user may have edited the
 * message it answers (the edit deletes it and what follows, then re-sends it).
 * Saving it then would resurrect a stale answer after a reload. A message sent
 * after the stop does not matter: the answer sorts before it. Looks up the
 * turn's own user message by id. Fails open: if the check fails the answer is
 * saved.
 */
async function isSuperseded(ctx: ChatTurnContext): Promise<boolean> {
  try {
    const [stored] = await getMessageById({ id: ctx.message.id });
    return isTurnSuperseded(ctx.userMessageCreatedAt, stored);
  } catch (err) {
    console.warn("[chat-stop] superseded check failed", ctx.chatId, err);
    return false;
  }
}

/**
 * Put the handler's last media card into the message, replacing the snapshot's
 * version of the same card (or appending it when the snapshot lacks it). The
 * snapshot can lag behind the handler when the response was cancelled while the
 * handler was still saving and charging. A finished card also gets back its
 * `file` part when the snapshot lacks it: without a model-content part the
 * message would be dropped from the model's history.
 */
function withFinalMediaPart(
  message: ChatMessage,
  finalMediaPart: MediaGenerationPart | undefined
): ChatMessage {
  if (!finalMediaPart) {
    return message;
  }
  const isSnapshotCard = (part: ChatMessage["parts"][number]): boolean =>
    part.type === "data-mediaGeneration" && part.id === finalMediaPart.id;

  const cardParts: ChatMessage["parts"] = message.parts.some(isSnapshotCard)
    ? message.parts.map((part) =>
        isSnapshotCard(part) ? finalMediaPart : part
      )
    : [...message.parts, finalMediaPart];

  const { status, url, mediaType } = finalMediaPart.data;
  const hasFilePart = cardParts.some(
    (part) => part.type === "file" && part.url === url
  );
  if (status !== "done" || !url || hasFilePart) {
    return { ...message, parts: cardParts };
  }

  return {
    ...message,
    parts: [
      ...cardParts,
      { type: "file", mediaType: MEDIA_FILE_TYPES[mediaType], url },
    ],
  };
}

/**
 * Stream-level onFinish: persist the assistant's messages and the chat's last
 * usage context. Text turns get text-part validation (a reasoning-only message
 * gets a synthesized fallback); image/video turns carry no message text since
 * their visible output lives in Documents. A stopped text turn is finalized as
 * interrupted instead: the partial text stays as-is, and no fallback text is
 * invented for it. A media turn takes its card from the handler's last write
 * (`ctx.finalMediaPart`) and never persists one that is still `generating`: it
 * becomes `stopped` if the turn was stopped, else `error`.
 */
export async function persistAssistantTurn(
  ctx: ChatTurnContext,
  messages: ChatMessage[],
  mode: ChatMode,
  { aborted, finishedAt }: PersistAssistantTurnOptions
): Promise<void> {
  const shouldValidate = mode === "text";
  const interrupted = aborted && shouldValidate;

  // Billing already happened; only the stale message is dropped.
  if (aborted && (await isSuperseded(ctx))) {
    return;
  }

  const validatedMessages = messages.map((message) => {
    if (message.role === "assistant" && interrupted) {
      return finalizeInterruptedMessage(message);
    }
    if (message.role === "assistant" && shouldValidate) {
      return ensureMessageHasTextPart(message, {
        modelId: ctx.model,
        stepCount: messages.length,
        stepLimit: ctx.stepLimit,
      });
    }
    if (message.role === "assistant") {
      return finalizeMediaGenerationParts(
        withFinalMediaPart(message, ctx.finalMediaPart),
        aborted ? "stopped" : "error"
      );
    }
    return message;
  });

  await saveMessages({
    messages: validatedMessages.map((message) => ({
      id: message.id,
      role: message.role,
      parts: message.parts,
      createdAt: finishedAt,
      attachments: [],
      chatId: ctx.chatId,
      modelId: message.role === "assistant" ? ctx.model : null,
    })),
  });

  if (ctx.lastUsage.value) {
    try {
      await updateChatLastContextById({
        chatId: ctx.chatId,
        context: ctx.lastUsage.value,
      });
    } catch (err) {
      console.warn("Unable to persist last usage for chat", ctx.chatId, err);
    }
  }
}
