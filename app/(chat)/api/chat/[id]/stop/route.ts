import { auth } from "@/app/(auth)/auth";
import { getChatById } from "@/lib/db/query/chat/get-chat-by-id";
import type { Chat } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import { stopBodySchema } from "../../_lib/stop-body";
import { requestChatStop } from "../../_lib/stop-signal";

/**
 * "Stop" button: ask whichever instance is generating the text answer of turn
 * `turnId` to abort. The abort itself happens on that instance;
 * this only delivers the signal, so it answers 204 as soon as the signal is
 * handed over.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chatId } = await params;

  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  let turnId: string;
  try {
    ({ turnId } = stopBodySchema.parse(await request.json()));
  } catch {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  let chat: Chat | null;
  try {
    chat = await getChatById({ id: chatId });
  } catch {
    return new ChatSDKError("not_found:chat").toResponse();
  }

  // A brand-new chat may not be saved yet when an early stop arrives (the
  // first POST is still being prepared). The marker is keyed by the user and
  // by two random UUIDs and can only abort that one turn, so it is safe to accept.
  if (chat && chat.userId !== session.user.id) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  await requestChatStop({ userId: session.user.id, chatId, turnId });

  return new Response(null, { status: 204 });
}
