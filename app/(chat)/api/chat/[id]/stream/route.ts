import { createUIMessageStream, JsonToSseTransformStream } from "ai";
import { differenceInSeconds } from "date-fns";
import { auth } from "@/app/(auth)/auth";
import { getChatById } from "@/lib/db/query/chat/get-chat-by-id";
import { getMessagesByChatId } from "@/lib/db/query/chat/get-messages-by-chat-id";
import { getStreamIdsByChatId } from "@/lib/db/query/chat/get-stream-ids-by-chat-id";
import type { Chat } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import { getStreamContext } from "../../_lib/stream-context";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chatId } = await params;

  const streamContext = getStreamContext();
  const resumeRequestedAt = new Date();

  if (!streamContext) {
    return new Response(null, { status: 204 });
  }

  if (!chatId) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

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

  const streamIds = await getStreamIdsByChatId({ chatId });

  if (!streamIds.length) {
    return new ChatSDKError("not_found:stream").toResponse();
  }

  const recentStreamId = streamIds.at(-1);

  if (!recentStreamId) {
    return new ChatSDKError("not_found:stream").toResponse();
  }

  const emptyDataStream = createUIMessageStream<ChatMessage>({
    // biome-ignore lint/suspicious/noEmptyBlockStatements: "Needs to exist"
    execute: () => {},
  });

  // 2.2.x `resumeExistingStream` returns:
  //   - undefined: no stream key in Redis (POST never started / TTL expired)
  //   - null: stream finished cleanly (sentinel set to DONE by publisher)
  //   - ReadableStream<string>: in-progress stream to replay
  // 2.2.x also rejects the underlying promise on ack timeout (publisher dead),
  // so wrap the call in try/catch and treat any failure as "no resume" — the
  // 15-second DB replay below handles the persisted-message fallback.
  let stream: ReadableStream<string> | null | undefined;
  try {
    stream = await streamContext.resumeExistingStream(recentStreamId);
  } catch (error) {
    console.warn(
      "[chat-stream] resumeExistingStream rejected:",
      error instanceof Error ? error.message : error
    );
    stream = null;
  }

  // Even after a clean resolve, the stream itself can error mid-pipe (the lib
  // queues `controller.error("Timeout waiting for ack")` from a racing
  // setTimeout when the publisher acks near the 1s deadline). Wrap so a
  // mid-stream error becomes a graceful close — the client's useAutoResume
  // just sees end-of-stream instead of a network crash.
  const guardErrors = (source: ReadableStream<string>) =>
    new ReadableStream<string>({
      async start(controller) {
        const reader = source.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              controller.close();
              return;
            }
            controller.enqueue(value);
          }
        } catch (error) {
          console.warn(
            "[chat-stream] resume stream errored:",
            error instanceof Error ? error.message : error
          );
          controller.close();
        } finally {
          reader.releaseLock();
        }
      },
      cancel(reason) {
        source.cancel(reason).catch(() => {
          // swallow — already cancelled
        });
      },
    });

  /*
   * For when the generation is streaming during SSR
   * but the resumable stream has concluded at this point.
   */
  if (!stream) {
    const messages = await getMessagesByChatId({ id: chatId });
    const mostRecentMessage = messages.at(-1);

    if (!mostRecentMessage) {
      return new Response(emptyDataStream, { status: 200 });
    }

    if (mostRecentMessage.role !== "assistant") {
      return new Response(emptyDataStream, { status: 200 });
    }

    const messageCreatedAt = new Date(mostRecentMessage.createdAt);

    if (differenceInSeconds(resumeRequestedAt, messageCreatedAt) > 15) {
      return new Response(emptyDataStream, { status: 200 });
    }

    const restoredStream = createUIMessageStream<ChatMessage>({
      execute: ({ writer }) => {
        writer.write({
          type: "data-appendMessage",
          data: JSON.stringify(mostRecentMessage),
          transient: true,
        });
      },
    });

    return new Response(
      restoredStream.pipeThrough(new JsonToSseTransformStream()),
      { status: 200 }
    );
  }

  return new Response(guardErrors(stream), { status: 200 });
}
