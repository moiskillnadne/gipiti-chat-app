import { createUIMessageStream, JsonToSseTransformStream } from "ai";
import { auth } from "@/app/(auth)/auth";
import { deleteChatById } from "@/lib/db/query/chat/delete-chat-by-id";
import { getChatById } from "@/lib/db/query/chat/get-chat-by-id";
import { ChatSDKError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";
import type { StreamHandler } from "./_lib/context";
import { enforceBalance } from "./_lib/enforce-balance";
import { handleChatError } from "./_lib/handle-error";
import { runImageGeneration } from "./_lib/handlers/image-generation";
import { runTextChat } from "./_lib/handlers/text-chat";
import { runVideoGeneration } from "./_lib/handlers/video-generation";
import { parseRequestBody } from "./_lib/parse-request";
import { persistAssistantTurn } from "./_lib/persist-assistant-turn";
import { prepareChatTurn } from "./_lib/prepare-chat-turn";
import { type ChatMode, resolveChatMode } from "./_lib/resolve-mode";
import { getStreamContext } from "./_lib/stream-context";

export const maxDuration = 300;

const STREAM_HANDLERS: Record<ChatMode, StreamHandler> = {
  text: runTextChat,
  image: runImageGeneration,
  video: runVideoGeneration,
};

export async function POST(request: Request) {
  const parsed = await parseRequestBody(request);
  if (!parsed.ok) {
    return parsed.response;
  }

  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const ctx = await prepareChatTurn(parsed.body, session, request);

    // Balance is enforced after the user message is saved so the client never
    // 404s on a freshly created chat.
    const insufficientBalance = await enforceBalance(ctx);
    if (insufficientBalance) {
      return insufficientBalance;
    }

    const mode = resolveChatMode(ctx.model);
    const runHandler = STREAM_HANDLERS[mode];

    const buildSseStream = () =>
      createUIMessageStream({
        execute: async ({ writer }) => {
          // Send modelId immediately so the client shows the right provider icon.
          writer.write({ type: "data-modelId", data: ctx.model });
          await runHandler(ctx, writer);
        },
        generateId: generateUUID,
        onFinish: ({ messages }) =>
          persistAssistantTurn(ctx, messages as ChatMessage[], mode),
        onError: () => "Oops, an error occurred!",
      }).pipeThrough(new JsonToSseTransformStream());

    // Wrap with resumable-stream so the GET /stream endpoint can replay
    // in-flight chunks via Redis pub/sub when the client reconnects. Falls back
    // to a bare stream when REDIS_URL is missing (getStreamContext returns null).
    const streamContext = getStreamContext();
    const sseStream = streamContext
      ? await streamContext.resumableStream(ctx.streamId, buildSseStream)
      : buildSseStream();

    return new Response(sseStream);
  } catch (error) {
    return handleChatError(error, request);
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
