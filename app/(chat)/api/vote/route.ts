import { z } from "zod";
import { ChatSDKError } from "@/lib/errors";
import { auth } from "@/server/modules/auth/next-auth";
import { getChatById } from "@/server/modules/chat/queries/get-chat-by-id";
import { getMessageById } from "@/server/modules/chat/queries/get-message-by-id";
import { getVotesByChatId } from "@/server/modules/chat/queries/get-votes-by-chat-id";
import { voteMessage } from "@/server/modules/chat/queries/vote-message";

const voteRequestSchema = z.object({
  chatId: z.string().uuid(),
  messageId: z.string().uuid(),
  type: z.enum(["up", "down"]),
});

const invalidVoteRequestResponse = (): Response =>
  new ChatSDKError(
    "bad_request:api",
    "Body must be JSON with chatId (uuid), messageId (uuid) and type (up | down)."
  ).toResponse();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chatId");

  if (!chatId) {
    return new ChatSDKError(
      "bad_request:api",
      "Parameter chatId is required."
    ).toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:vote").toResponse();
  }

  const chat = await getChatById({ id: chatId });

  if (!chat) {
    return new ChatSDKError("not_found:chat").toResponse();
  }

  if (chat.userId !== session.user.id) {
    return new ChatSDKError("forbidden:vote").toResponse();
  }

  const votes = await getVotesByChatId({ id: chatId });

  return Response.json(votes, { status: 200 });
}

export async function PATCH(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:vote").toResponse();
  }

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return invalidVoteRequestResponse();
  }

  const parsedBody = voteRequestSchema.safeParse(requestBody);
  if (!parsedBody.success) {
    return invalidVoteRequestResponse();
  }

  const { chatId, messageId, type } = parsedBody.data;

  const chat = await getChatById({ id: chatId });

  if (!chat) {
    return new ChatSDKError("not_found:vote").toResponse();
  }

  if (chat.userId !== session.user.id) {
    return new ChatSDKError("forbidden:vote").toResponse();
  }

  // One answer for "no such message" and "message of another chat", so the
  // response never reveals whether a message id exists elsewhere.
  const [votedMessage] = await getMessageById({ id: messageId });

  if (votedMessage?.chatId !== chatId) {
    return new ChatSDKError("not_found:vote").toResponse();
  }

  await voteMessage({
    chatId,
    messageId,
    type,
  });

  return new Response("Message voted", { status: 200 });
}
