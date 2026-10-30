import { ensureMessageHasTextPart } from "@/lib/ai/message-validator";
import { getLatestUserMessageByChatId } from "@/lib/db/query/chat/get-latest-user-message-by-chat-id";
import { saveMessages } from "@/lib/db/query/chat/save-messages";
import { updateChatLastContextById } from "@/lib/db/query/chat/update-chat-last-context-by-id";
import { finalizeInterruptedMessage } from "@/lib/messages/interrupted";
import type { ChatMessage } from "@/lib/types";
import type { ChatTurnContext } from "./context";
import type { ChatMode } from "./resolve-mode";
import { isTurnSuperseded } from "./turn-superseded";

export type PersistAssistantTurnOptions = {
  /** The user stopped the turn: save the partial answer with the interrupted mark. */
  aborted: boolean;
  /** One timestamp for the whole turn, so messages keep their stream order. */
  finishedAt: Date;
};

/**
 * An interrupted answer can be saved long after the stop (it waits for a
 * deferred tool and for billing), by which time the user may have edited the
 * message it answers (the edit deletes the message and what follows) or sent a
 * newer one. Saving it then would resurrect a stale answer after a reload.
 * Fails open: if the check itself fails the answer is saved.
 */
async function isSuperseded(ctx: ChatTurnContext): Promise<boolean> {
  try {
    const latest = await getLatestUserMessageByChatId({ chatId: ctx.chatId });
    return isTurnSuperseded(
      { id: ctx.message.id, createdAt: ctx.userMessageCreatedAt },
      latest
    );
  } catch (err) {
    console.warn("[chat-stop] superseded check failed", ctx.chatId, err);
    return false;
  }
}

/**
 * Stream-level onFinish: persist the assistant's messages and the chat's last
 * usage context. Text turns get text-part validation (a reasoning-only message
 * gets a synthesized fallback); image/video turns are saved as-is since their
 * visible output lives in Documents, not message text. A stopped text turn is
 * finalized as interrupted instead: the partial text stays as-is, and no
 * fallback text is invented for it.
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
  if (interrupted && (await isSuperseded(ctx))) {
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
