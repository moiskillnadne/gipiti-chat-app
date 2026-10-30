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
import { createTurnAbort } from "./_lib/turn-abort";
import { waitForSettlement, waitWithTimeout } from "./_lib/turn-lifecycle";

export const maxDuration = 300;

// Upper bound for waiting on a text turn's billing before persisting it.
const SETTLEMENT_TIMEOUT_MS = 15_000;
// Upper bound for keeping the function alive for the stop watcher's cleanup.
const STOP_WATCH_CLEANUP_TIMEOUT_MS = 5000;

const STREAM_HANDLERS: Record<ChatMode, StreamHandler> = {
  text: runTextChat,
  image: runImageGeneration,
  video: runVideoGeneration,
};

export async function POST(request: Request) {
  const turnAbort = createTurnAbort({
    startedAt: Date.now(),
    maxDurationMs: maxDuration * 1000,
  });

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

  let stopWatch: ReturnType<typeof watchChatStop> | undefined;
  // Resolved when the stop watcher is cleaned up (or there was none).
  const { promise: stopWatchClosed, resolve: markStopWatchClosed } =
    Promise.withResolvers<void>();
  // Cleanup talks to Redis and must never hold up the stream or the error
  // response: start it, and let `after()` keep the function alive for it.
  const closeStopWatch = () => {
    turnAbort.dispose();
    if (!stopWatch) {
      markStopWatchClosed();
      return;
    }
    stopWatch().finally(markStopWatchClosed);
  };
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
    if (!streamContext) {
      if (request.signal.aborted) {
        turnAbort.requestAbort();
      } else {
        request.signal.addEventListener("abort", turnAbort.requestAbort, {
          once: true,
        });
      }
    }

    const ctx = await prepareChatTurn(parsed.body, session, request, {
      turnAbort,
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
    // Not awaited: subscribing to the stop channel must not delay the first
    // token (the early-stop check inside still covers a stop that already landed).
    if (mode === "text") {
      stopWatch = watchChatStop({
        userId: ctx.userId,
        chatId: ctx.chatId,
        turnId: ctx.turnId,
        onStop: turnAbort.requestAbort,
      });
      after(() =>
        waitWithTimeout(stopWatchClosed, STOP_WATCH_CLEANUP_TIMEOUT_MS)
      );
    } else {
      // Nothing bills these turns through the settlement; do not wait for it.
      ctx.turnSettlement.resolve();
    }

    // Without a stream context nothing else keeps the function alive after the
    // client disconnects, but an aborted turn still has to be settled (charged)
    // and persisted in onFinish.
    if (!streamContext) {
      after(() => turnDone);
      // Uncapped on purpose: `maxDuration` bounds it, and a stopped turn must
      // be charged even when persisting did not wait for it.
      after(() => ctx.turnSettlement.promise);
    }

    const buildSseStream = () =>
      createUIMessageStream({
        execute: async ({ writer }) => {
          // Stopped before the handler ran (the stop beat the start of the
          // turn): no model call, no charge, nothing to persist.
          if (mode === "text" && turnAbort.signal.aborted) {
            ctx.turnOutcome = "skipped";
            ctx.turnSettlement.resolve();
            return;
          }
          // Send modelId immediately so the client shows the right provider icon.
          writer.write({ type: "data-modelId", data: ctx.model });
          // A resumed stream is read by a client that did not make the POST:
          // this is how it learns which turn its Stop button must name.
          writer.write({
            type: "data-turnId",
            data: ctx.turnId,
            transient: true,
          });
          await runHandler(ctx, writer);
        },
        generateId: generateUUID,
        onFinish: async ({ messages, isAborted }) => {
          const finishedAt = new Date();
          try {
            // Disconnect cancels the response before streamText's `onAbort`
            // runs, and the SDK does not await it anyway: wait for the turn to
            // be billed (every terminal path of the handler resolves this)
            // before persisting.
            const settled =
              mode !== "text" ||
              (await waitForSettlement(
                ctx.turnSettlement,
                SETTLEMENT_TIMEOUT_MS
              ));
            if (ctx.turnOutcome === "skipped") {
              return;
            }
            // Interrupted only if the stop path actually settled the turn (or
            // the stream itself ended aborted). A stop that lands after the
            // answer was complete leaves it a normal message. If billing is
            // still running after the wait (a deferred stop outlasting it), a
            // requested stop means the message is cut off all the same.
            const aborted =
              mode === "text" &&
              (isAborted ||
                ctx.turnOutcome === "aborted" ||
                (!settled && turnAbort.requestedAt !== undefined));
            await persistAssistantTurn(ctx, messages as ChatMessage[], mode, {
              aborted,
              // An interrupted answer ends where the user pressed Stop, so it
              // sorts before a message sent right after.
              finishedAt: aborted
                ? (turnAbort.requestedAt ?? finishedAt)
                : finishedAt,
            });
          } finally {
            closeStopWatch();
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
    closeStopWatch();
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
