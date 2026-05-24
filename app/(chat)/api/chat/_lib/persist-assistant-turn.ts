import { ensureMessageHasTextPart } from "@/lib/ai/message-validator";
import { saveMessages } from "@/lib/db/query/chat/save-messages";
import { updateChatLastContextById } from "@/lib/db/query/chat/update-chat-last-context-by-id";
import type { ChatMessage } from "@/lib/types";
import type { ChatTurnContext } from "./context";
import type { ChatMode } from "./resolve-mode";

/**
 * Stream-level onFinish: persist the assistant's messages and the chat's last
 * usage context. Text turns get text-part validation (a reasoning-only message
 * gets a synthesized fallback); image/video turns are saved as-is since their
 * visible output lives in Documents, not message text.
 */
export async function persistAssistantTurn(
  ctx: ChatTurnContext,
  messages: ChatMessage[],
  mode: ChatMode
): Promise<void> {
  const shouldValidate = mode === "text";

  const validatedMessages = messages.map((message) => {
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
      createdAt: new Date(),
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
