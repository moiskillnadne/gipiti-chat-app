import { createUIMessageStream, JsonToSseTransformStream } from "ai";
import { after } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { recordUserActivity } from "@/lib/activity/record-user-activity";
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
import { watchChatStop } from "./_lib/stop-signal";
import { getStreamContext } from "./_lib/stream-context";

export const maxDuration = 300;

const STREAM_HANDLERS: Record<ChatMode, StreamHandler> = {
  text: runTextChat,
  image: runImageGeneration,
  video: runVideoGeneration,
};

export async function POST(request: Request) {
  // Stop signals older than this are ignored (see stop-signal.ts).
  const startedAt = Date.now();
  const abortController = new AbortController();

  const parsed = await parseRequestBody(request);
  if (!parsed.ok) {
    return parsed.response;
  }

  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  // Catches tabs left open across Moscow midnight that chat without reloading.
  recordUserActivity(session.user.id);

  let stopWatch: Awaited<ReturnType<typeof watchChatStop>> | undefined;
  // Resolved when the turn is fully persisted (or failed before streaming).
  const { promise: turnDone, resolve: finishTurn } =
    Promise.withResolvers<void>();

  try {
    // Wrap with resumable-stream so the GET /stream endpoint can replay
    // in-flight chunks via Redis pub/sub when the client reconnects. Falls back
    // to a bare stream when REDIS_URL is missing (getStreamContext returns null).
    const streamContext = getStreamContext();

    // With resumable streams the client may drop and reconnect without meaning
    // to stop, so only an explicit stop aborts. Without them there is nothing
    // to reconnect to: a dropped connection means the user left, stop too.
    const abortSignal = streamContext
      ? abortController.signal
      : AbortSignal.any([abortController.signal, request.signal]);

    const ctx = await prepareChatTurn(parsed.body, session, request, {
      startedAt,
      abortSignal,
    });

    // Balance is enforced after the user message is saved so the client never
    // 404s on a freshly created chat.
    const insufficientBalance = await enforceBalance(ctx);
    if (insufficientBalance) {
      return insufficientBalance;
    }

    const mode = resolveChatMode(ctx.model);
    const runHandler = STREAM_HANDLERS[mode];

    // Only text turns can be stopped; image/video handlers run to completion.
    if (mode === "text") {
      stopWatch = await watchChatStop({
        chatId: ctx.chatId,
        startedAt,
        onStop: () => abortController.abort("user-stop"),
      });
    }

    // Without a stream context nothing else keeps the function alive after the
    // client disconnects, but an aborted turn still has to be settled (charged)
    // and persisted in onFinish.
    if (!streamContext) {
      after(() => turnDone);
    }

    const buildSseStream = () =>
      createUIMessageStream({
        execute: async ({ writer }) => {
          // Send modelId immediately so the client shows the right provider icon.
          writer.write({ type: "data-modelId", data: ctx.model });
          await runHandler(ctx, writer);
        },
        generateId: generateUUID,
        onFinish: async ({ messages, isAborted }) => {
          const finishedAt = new Date();
          const aborted =
            mode === "text" && (isAborted || ctx.abortSignal.aborted);
          try {
            // The SDK does not await streamText's onAbort, so the handler's
            // billing settlement is awaited here, before the turn is persisted.
            if (aborted) {
              await ctx.abortSettlement.value;
            }
            await persistAssistantTurn(ctx, messages as ChatMessage[], mode, {
              aborted,
              finishedAt,
            });
          } finally {
            await stopWatch?.();
            finishTurn();
          }
        },
        onError: () => "Oops, an error occurred!",
      }).pipeThrough(new JsonToSseTransformStream());

    // `createNewResumableStream` (2.2.x API) sets the sentinel to "1" via SET,
    // unlike the older `resumableStream` which uses INCR. INCR conflicts with
    // the GET endpoint's `resumeExistingStream` that uses GET to check state,
    // so the explicit new/resume split is more correct.
    const sseStream = streamContext
      ? await streamContext.createNewResumableStream(
          ctx.streamId,
          buildSseStream
        )
      : buildSseStream();

    return new Response(sseStream);
  } catch (error) {
    await stopWatch?.();
    finishTurn();
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
