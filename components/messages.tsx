import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { AnimatePresence } from "framer-motion";
import { ArrowDownIcon } from "lucide-react";
import { memo, useEffect } from "react";
import { useModel } from "@/contexts/model-context";
import { useMessages } from "@/hooks/use-messages";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Conversation, ConversationContent } from "./elements/conversation";
import { Greeting } from "./greeting";
import { PreviewMessage, ThinkingMessage } from "./message";

type MessagesProps = {
  chatId: string;
  status: UseChatHelpers<ChatMessage>["status"];
  votes: Vote[] | undefined;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  isArtifactVisible: boolean;
};

function PureMessages({
  chatId,
  status,
  votes,
  messages,
  setMessages,
  regenerate,
  isReadonly,
}: MessagesProps) {
  const { currentModelId } = useModel();
  const {
    containerRef: messagesContainerRef,
    endRef: messagesEndRef,
    isAtBottom,
    scrollToBottom,
    hasSentMessage,
  } = useMessages({
    status,
  });

  // Find the index of the last assistant message
  const lastAssistantMessageIndex = messages.reduce<number>(
    (lastIndex, message, index) =>
      message.role === "assistant" ? index : lastIndex,
    -1
  );

  useEffect(() => {
    if (status === "submitted") {
      requestAnimationFrame(() => {
        const container = messagesContainerRef.current;
        if (container) {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: "smooth",
          });
        }
      });
    }
  }, [status, messagesContainerRef]);

  return (
    <div
      className="overscroll-behavior-contain -webkit-overflow-scrolling-touch flex-1 touch-pan-y overflow-y-scroll"
      ref={messagesContainerRef}
      style={{ overflowAnchor: "none" }}
    >
      <Conversation
        className={cn(
          "mx-auto flex min-w-0 max-w-4xl flex-col gap-4 md:gap-6",
          messages.length === 0 && "min-h-full",
          messages.length === 0 && "justify-center"
        )}
      >
        <ConversationContent
          className={cn(
            "flex flex-col gap-4 px-2 py-4 md:gap-6 md:px-4",
            messages.length === 0 && "min-h-full"
          )}
        >
          {messages.length === 0 && <Greeting />}

          {(() => {
            // #region agent log
            const assistantMsgs = messages.filter(m => m.role === 'assistant');
            const msgsWithCreateDoc = assistantMsgs.filter(m => m.parts?.some(p => p.type === 'tool-createDocument'));
            if (msgsWithCreateDoc.length > 0) {
              fetch('http://127.0.0.1:7243/ingest/afd4d0df-289c-4211-8f44-f973dd807050',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0e88c6'},body:JSON.stringify({sessionId:'0e88c6',location:'messages.tsx:render',message:'Messages with createDocument parts',data:{totalMessages:messages.length,assistantMessages:assistantMsgs.length,msgsWithCreateDocCount:msgsWithCreateDoc.length,msgsWithCreateDocIds:msgsWithCreateDoc.map(m=>m.id),msgsWithCreateDocDetails:msgsWithCreateDoc.map(m=>({id:m.id,partsCount:m.parts?.length,toolCreateDocParts:m.parts?.filter(p=>p.type==='tool-createDocument').map((p:any)=>({toolCallId:p.toolCallId,state:p.state}))}))},timestamp:Date.now(),hypothesisId:'C_D'})}).catch(()=>{});
            }
            // #endregion
            return null;
          })()}
          {messages.map((message, index) => (
            <PreviewMessage
              chatId={chatId}
              isLastAssistantMessage={index === lastAssistantMessageIndex}
              isLoading={
                status === "streaming" && messages.length - 1 === index
              }
              isReadonly={isReadonly}
              key={message.id}
              message={message}
              regenerate={regenerate}
              requiresScrollPadding={
                hasSentMessage && index === messages.length - 1
              }
              setMessages={setMessages}
              vote={
                votes
                  ? votes.find((vote) => vote.messageId === message.id)
                  : undefined
              }
            />
          ))}

          <AnimatePresence mode="wait">
            {status === "submitted" && (
              <ThinkingMessage key="thinking" modelId={currentModelId} />
            )}
          </AnimatePresence>

          <div
            className="min-h-[24px] min-w-[24px] shrink-0"
            ref={messagesEndRef}
          />
        </ConversationContent>
      </Conversation>

      {!isAtBottom && (
        <button
          aria-label="Scroll to bottom"
          className="-translate-x-1/2 absolute bottom-40 left-1/2 z-10 rounded-full border bg-background p-2 shadow-lg transition-colors hover:bg-muted"
          onClick={() => scrollToBottom("smooth")}
          type="button"
        >
          <ArrowDownIcon className="size-4" />
        </button>
      )}
    </div>
  );
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.isArtifactVisible && nextProps.isArtifactVisible) {
    return true;
  }

  if (prevProps.status !== nextProps.status) {
    return false;
  }
  if (prevProps.messages.length !== nextProps.messages.length) {
    return false;
  }
  if (!equal(prevProps.messages, nextProps.messages)) {
    return false;
  }
  if (!equal(prevProps.votes, nextProps.votes)) {
    return false;
  }
  if (prevProps.regenerate !== nextProps.regenerate) {
    return false;
  }

  return false;
});
