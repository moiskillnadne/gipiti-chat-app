import { createUIMessageStream, JsonToSseTransformStream } from "ai";
import { after } from "next/server";
import { ChatSDKError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";
import { recordUserActivity } from "@/server/http/record-user-activity";
import { auth } from "@/server/modules/auth/next-auth";
import { deleteChatById } from "@/server/modules/chat/queries/delete-chat-by-id";
import { getChatById } from "@/server/modules/chat/queries/get-chat-by-id";
import type { StreamHandler } from "./_lib/context";
import { enforceBalance } from "./_lib/enforce-balance";
import { handleChatError } from "./_lib/handle-error";
import { runImageGeneration } from "./_lib/handlers/image-generation";
import { runTextChat } from "./_lib/handlers/text-chat";
import { runVideoGeneration } from "./_lib/handlers/video-generation";
import { parseRequestBody } from "./_lib/parse-request";
import { persistAssistantTurn } from "./_lib/persist-assistant-turn";
import { prepareChatTurn } from "./_lib/prepare-chat-turn";
import {
  type ChatMode,
  resolveChatMode,
  resolveRequestedModel,
} from "./_lib/resolve-mode";
import { watchChatStop } from "./_lib/stop-signal";
import { getStreamContext } from "./_lib/stream-context";
import { createTurnAbort } from "./_lib/turn-abort";
import {
  startTurnDiagnostics,
  type TurnDiagnostics,
} from "./_lib/turn-diagnostics";
import {
  isTurnAborted,
  mediaPersistWaitMs,
  waitForSettlement,
  waitWithTimeout,
} from "./_lib/turn-lifecycle";
import {
  acquireChatTurnSlot,
  enforceChatRateLimit,
  runHoldingTurnSlot,
} from "./_lib/turn-slot";

// The GA maximum for Pro with Fluid compute: long reasoning answers need more
// than the 300s project default. Above 800s the platform limit is beta-only.
export const maxDuration = 800;

// Upper bound for waiting on a text turn's billing before persisting it.
const SETTLEMENT_TIMEOUT_MS = 15_000;
// A media turn waits for its handler (download, upload, save, charge) until
// this long before the function deadline, leaving room to persist the message.
// Capped by the deadline, not a short timeout: a video tail can take longer
// than SETTLEMENT_TIMEOUT_MS, and the saved card cannot be corrected later.
const MEDIA_PERSIST_MARGIN_MS = 10_000;
// Upper bound for keeping the function alive for the stop watcher's cleanup.
const STOP_WATCH_CLEANUP_TIMEOUT_MS = 5000;
// The stop watcher unregisters itself this long after the function deadline,
// in case the turn never reached its cleanup.
const STOP_WATCH_LIFETIME_MARGIN_MS = 30_000;

const STREAM_HANDLERS: Record<ChatMode, StreamHandler> = {
  text: runTextChat,
  image: runImageGeneration,
  video: runVideoGeneration,
};

export async function POST(request: Request) {
  const turnStartedAt = Date.now();
  const turnAbort = createTurnAbort({
    startedAt: turnStartedAt,
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

  // Rate limit, then hold one of the user's turn slots for this mode until the
  // turn's charge is written: the balance gate below then sees the previous
  // turn's charge. Both reject with 429 before anything is saved.
  const mode = resolveChatMode(
    resolveRequestedModel(parsed.body.selectedChatModel)
  );
  let slot: Awaited<ReturnType<typeof acquireChatTurnSlot>>;
  try {
    await enforceChatRateLimit(session.user.id);
    slot = await acquireChatTurnSlot({
      userId: session.user.id,
      mode,
      ttlMs: maxDuration * 1000,
    });
  } catch (error) {
    return handleChatError(error, request);
  }
  // Keeps the function alive for a release that lands after the response.
  after(() => waitWithTimeout(slot.whenReleased, maxDuration * 1000));
  // Set right before the mode handler runs; from then on the handler's own
  // terminal paths release the slot (runHoldingTurnSlot).
  let isHandlerStarted = false;

  let stopWatch: ReturnType<typeof watchChatStop> | undefined;
  // Resolved when the stop watcher is cleaned up (or there was none).
  const { promise: stopWatchClosed, resolve: markStopWatchClosed } =
    Promise.withResolvers<void>();
  // Cleanup talks to Redis and must never hold up the stream or the error
  // response: start it, and let `after()` keep the function alive for it.
  const closeStopWatch = () => {
    if (!stopWatch) {
      markStopWatchClosed();
      return;
    }
    stopWatch().finally(markStopWatchClosed);
  };
  // Resolved when the turn is fully persisted (or failed before streaming).
  const { promise: turnDone, resolve: finishTurn } =
    Promise.withResolvers<void>();
  // Resolved when the mode handler has returned (or never ran). A cancelled
  // response runs onFinish while a media handler is still saving and charging.
  const { promise: handlerDone, resolve: finishHandler } =
    Promise.withResolvers<void>();
  // Set once the turn is about to stream; logs how and when it ended.
  let turnDiagnostics: TurnDiagnostics | undefined;

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

    // The force timer must outlive the persist-time wait for billing (a hung
    // tool is only settled by it): it ends with the settlement, not before.
    ctx.turnSettlement.promise.finally(() => turnAbort.dispose());

    // Balance is enforced after the user message is saved so the client never
    // 404s on a freshly created chat.
    const insufficientBalance = await enforceBalance(ctx);
    if (insufficientBalance) {
      // No provider call was made: nothing to charge, free the slot now.
      slot.release();
      return insufficientBalance;
    }

    const runHandler = STREAM_HANDLERS[mode];

    turnDiagnostics = startTurnDiagnostics({
      fields: {
        chatId: ctx.chatId,
        turnId: ctx.turnId,
        model: ctx.model,
        mode,
      },
      startedAt: turnStartedAt,
      maxDurationMs: maxDuration * 1000,
    });

    // Every mode can be stopped. Not awaited: subscribing to the stop channel
    // must not delay the first token (the early-stop check inside still covers
    // a stop that already landed).
    stopWatch = watchChatStop({
      userId: ctx.userId,
      chatId: ctx.chatId,
      turnId: ctx.turnId,
      onStop: turnAbort.requestAbort,
      maxLifetimeMs: maxDuration * 1000 + STOP_WATCH_LIFETIME_MARGIN_MS,
    });
    after(() =>
      waitWithTimeout(stopWatchClosed, STOP_WATCH_CLEANUP_TIMEOUT_MS)
    );
    if (mode !== "text") {
      // Nothing bills these turns through the settlement; do not wait for it.
      ctx.turnSettlement.resolve();
    }

    // Without a stream context nothing else keeps the function alive after the
    // client disconnects, but an aborted turn still has to be settled (charged)
    // and persisted in onFinish.
    if (!streamContext) {
      after(() => turnDone);
      if (mode !== "text") {
        // The charge tail of a media handler must not be cut off by a
        // response that was cancelled under it.
        after(() => handlerDone);
      }
      // Uncapped on purpose: `maxDuration` bounds it, and a stopped turn must
      // be charged even when persisting did not wait for it.
      after(() => ctx.turnSettlement.promise);
    }

    const waitForTurnEnd = async (): Promise<boolean> => {
      if (mode === "text") {
        return waitForSettlement(ctx.turnSettlement, SETTLEMENT_TIMEOUT_MS);
      }
      await waitWithTimeout(
        handlerDone,
        mediaPersistWaitMs({
          startedAt: turnStartedAt,
          maxDurationMs: maxDuration * 1000,
          marginMs: MEDIA_PERSIST_MARGIN_MS,
          now: Date.now(),
        })
      );
      return true;
    };

    const buildSseStream = () =>
      createUIMessageStream({
        execute: async ({ writer }) => {
          // Stopped before the handler ran (the stop beat the start of the
          // turn): no model call, no charge, nothing to persist.
          if (turnAbort.signal.aborted) {
            ctx.turnOutcome = "skipped";
            ctx.turnSettlement.resolve();
            finishHandler();
            slot.release();
            return;
          }
          try {
            // Send modelId immediately so the client shows the right provider icon.
            writer.write({ type: "data-modelId", data: ctx.model });
            // A resumed stream is read by a client that did not make the POST:
            // this is how it learns which turn its Stop button must name.
            writer.write({
              type: "data-turnId",
              data: ctx.turnId,
              transient: true,
            });
            isHandlerStarted = true;
            await runHoldingTurnSlot({
              mode,
              ctx,
              slot,
              run: () => runHandler(ctx, writer),
            });
          } finally {
            finishHandler();
          }
        },
        generateId: generateUUID,
        onFinish: async ({ messages, isAborted }) => {
          const finishedAt = new Date();
          let isTurnInterrupted = false;
          try {
            // Disconnect cancels the response before streamText's `onAbort`
            // runs, and the SDK does not await it anyway. Text: wait for the
            // turn to be billed (every terminal path of the handler resolves
            // it). Media: wait for the handler to return, so its outcome and
            // final card are known (it may still be saving and charging).
            const isSettled = await waitForTurnEnd();
            if (ctx.turnOutcome === "skipped") {
              return;
            }
            isTurnInterrupted = isTurnAborted({
              isTextTurn: mode === "text",
              isStreamAborted: isAborted,
              turnOutcome: ctx.turnOutcome,
              isSettled,
              hasStopRequest: turnAbort.requestedAt !== undefined,
            });
            await persistAssistantTurn(ctx, messages as ChatMessage[], mode, {
              aborted: isTurnInterrupted,
              // An interrupted answer ends where the user pressed Stop, so it
              // sorts before a message sent right after.
              finishedAt: isTurnInterrupted
                ? (turnAbort.requestedAt ?? finishedAt)
                : finishedAt,
            });
          } finally {
            turnDiagnostics?.end({
              outcome: ctx.turnOutcome,
              isAborted: isTurnInterrupted,
            });
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
    turnDiagnostics?.end({ outcome: "failed", isAborted: false });
    turnAbort.dispose();
    closeStopWatch();
    finishHandler();
    finishTurn();
    // Failed before the handler ran (no provider call): free the slot. Once it
    // ran, the handler's terminal paths release it after the charge.
    if (!isHandlerStarted) {
      slot.release();
    }
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
