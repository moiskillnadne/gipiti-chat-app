"use server";

import { generateText, type UIMessage } from "ai";
import { cookies } from "next/headers";
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
  cookieStore.set(`thinking-${modelId}`, value);
}

export async function getThinkingSettingCookie(
  modelId: string
): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(`thinking-${modelId}`)?.value;
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
