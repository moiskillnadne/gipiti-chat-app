import { saveMessages } from "@/lib/db/query/chat/save-messages";
import { ChatSDKError } from "@/lib/errors";
import { getTranslations } from "@/lib/i18n/translate";
import { generateUUID } from "@/lib/utils";
import type { ChatTurnContext } from "./context";

/**
 * Pre-inference balance gate. When the user has no spendable balance, persist a
 * localized assistant notice (so the chat isn't left empty) and return a
 * quota_exceeded Response for the caller to send. Returns null to proceed.
 *
 * Runs after prepareChatTurn so the user message is already saved.
 */
export async function enforceBalance(
  ctx: ChatTurnContext
): Promise<Response | null> {
  if (ctx.hasBalance) {
    return null;
  }

  const t = await getTranslations("chat");
  await saveMessages({
    messages: [
      {
        chatId: ctx.chatId,
        id: generateUUID(),
        role: "assistant",
        parts: [{ type: "text", text: t("errors.quotaExceededAssistant") }],
        attachments: [],
        createdAt: new Date(),
        modelId: null,
      },
    ],
  });

  return new ChatSDKError(
    "quota_exceeded:chat",
    undefined,
    "Insufficient balance. Please top up to continue."
  ).toResponse();
}
