import { auth } from "@/app/(auth)/auth";
import { getChatById } from "@/lib/db/query/chat/get-chat-by-id";
import type { Chat } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import { requestChatStop } from "../../_lib/stop-signal";

/**
 * "Stop" button: ask whichever instance is generating this chat's current text
 * answer to abort. The abort itself happens on that instance; this only
 * delivers the signal, so it answers 204 as soon as the signal is handed over.
 */
export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chatId } = await params;

  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  let chat: Chat | null;
  try {
    chat = await getChatById({ id: chatId });
  } catch {
    return new ChatSDKError("not_found:chat").toResponse();
  }

  if (!chat) {
    return new ChatSDKError("not_found:chat").toResponse();
  }

  if (chat.userId !== session.user.id) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  await requestChatStop(chatId);

  return new Response(null, { status: 204 });
}
