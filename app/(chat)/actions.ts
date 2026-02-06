"use server";

import type { GatewayProviderOptions } from "@ai-sdk/gateway";
import { generateText, type UIMessage } from "ai";
import { cookies } from "next/headers";
import { THINKING_COOKIE_PREFIX } from "@/lib/ai/models";
import { myProvider } from "@/lib/ai/providers";
import {
  deleteMessagesByChatIdAfterTimestamp,
  getMessageById,
} from "@/lib/db/queries";

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set("chat-model", model);
}

export async function saveThinkingSettingAsCookie(
  modelId: string,
  value: string
) {
  const cookieStore = await cookies();
  cookieStore.set(`${THINKING_COOKIE_PREFIX}-${modelId}`, value);
}

export async function generateTitleFromUserMessage({
  message,
}: {
  message: UIMessage;
}) {
  const { text: title } = await generateText({
    model: myProvider.languageModel("title-model"),
    system: `\n
    - you will generate a short title based on the first message a user begins a conversation with
    - ensure it is not more than 80 characters long
    - the title should be a summary of the user's message
    - do not use quotes or colons
    - IMPORTANT: Generate the title in the same language as the user's message`,
    prompt: JSON.stringify(message),
    providerOptions: {
      gateway: {
        models: ["openai/gpt-4.1-nano", "anthropic/claude-3-haiku"],
      } satisfies GatewayProviderOptions,
    },
  });

  return title;
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  const [message] = await getMessageById({ id });

  await deleteMessagesByChatIdAfterTimestamp({
    chatId: message.chatId,
    timestamp: message.createdAt,
  });
}
