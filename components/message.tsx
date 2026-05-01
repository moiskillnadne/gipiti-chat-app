"use client";
import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { memo, useMemo, useState } from "react";
import type { Vote } from "@/lib/db/schema";
import { downloadFromUrl } from "@/lib/download";
import { groupToolRuns } from "@/lib/messages/group-tool-runs";
import type { ChatMessage } from "@/lib/types";
import { cn, sanitizeText } from "@/lib/utils";
import { AssistantIcon } from "./assistant-icon";
import { MessageContent } from "./elements/message";
import { Response } from "./elements/response";
import { DownloadIcon } from "./icons";
import { MessageActions } from "./message-actions";
import { MessageEditor } from "./message-editor";
import { PreviewAttachment } from "./preview-attachment";
import { toast } from "./toast";
import { ToolRunRenderer } from "./tool-run-renderer";

/**
 * Extract modelId from message - checks metadata first (DB messages),
 * then falls back to message parts (streaming messages).
 */
const getModelIdFromMessage = (message: ChatMessage): string | undefined => {
  // First check metadata (for messages loaded from DB)
  if (message.metadata?.modelId) {
    return message.metadata.modelId;
  }
  // Then check message parts (for streaming messages)
  const modelIdPart = message.parts.find(
    (part) => part.type === "data-modelId"
  );
  if (modelIdPart && "data" in modelIdPart) {
    return modelIdPart.data as string;
  }
  return;
};

const PurePreviewMessage = ({
  chatId,
  message,
  vote,
  isLoading,
  setMessages,
  regenerate,
  isReadonly,
  requiresScrollPadding,
  isLastAssistantMessage,
}: {
  chatId: string;
  message: ChatMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  requiresScrollPadding: boolean;
  isLastAssistantMessage: boolean;
}) => {
  const t = useTranslations("chat.messages");
  const [mode, setMode] = useState<"view" | "edit">("view");

  const attachmentsFromMessage = message.parts.filter(
    (part) => part.type === "file"
  );

  const groupedParts = useMemo(
    () => groupToolRuns(message.parts ?? []),
    [message.parts]
  );

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="group/message w-full"
      data-role={message.role}
      data-testid={`message-${message.role}`}
      initial={{ opacity: 0 }}
    >
      <div
        className={cn("flex w-full items-start gap-2 md:gap-3", {
          "justify-end": message.role === "user" && mode !== "edit",
          "justify-start": message.role === "assistant",
        })}
      >
        {message.role === "assistant" && (
          <AssistantIcon
            isLoading={isLoading}
            modelId={getModelIdFromMessage(message)}
          />
        )}

        <div
          className={cn("flex flex-col", {
            "gap-2 md:gap-4":
              message.role === "assistant" ||
              message.parts?.some((p) => p.type === "text" && p.text?.trim()),
            "min-h-96": message.role === "assistant" && requiresScrollPadding,
            "w-full":
              (message.role === "assistant" &&
                message.parts?.some(
                  (p) => p.type === "text" && p.text?.trim()
                )) ||
              mode === "edit",
            "max-w-[calc(100%-2.5rem)] sm:max-w-[min(fit-content,80%)]":
              message.role === "user" && mode !== "edit",
          })}
        >
          {attachmentsFromMessage.length > 0 && message.role === "user" && (
            <div
              className="flex flex-row justify-end gap-2"
              data-testid={"message-attachments"}
            >
              {attachmentsFromMessage.map((attachment) => (
                <PreviewAttachment
                  attachment={{
                    name: attachment.filename ?? "file",
                    contentType: attachment.mediaType,
                    url: attachment.url,
                  }}
                  key={attachment.url}
                />
              ))}
            </div>
          )}

          {groupedParts.map((part, index) => {
            const key = `message-${message.id}-part-${index}`;

            if (part.type === "run-group") {
              return (
                <ToolRunRenderer
                  group={part}
                  isLastAssistantMessage={isLastAssistantMessage}
                  isMessageLoading={isLoading}
                  isReadonly={isReadonly}
                  key={part.key}
                />
              );
            }

            if (part.type === "data-imageGenerationFinish") {
              const { imageUrl, userPrompt, responseId } = part.data;

              const handleDownload = async (propUrl: string) => {
                try {
                  await downloadFromUrl(propUrl, "generated-image.png");
                } catch {
                  toast({
                    type: "error",
                    description: t("downloadError"),
                  });
                }
              };

              return (
                <div
                  className="group/image relative overflow-hidden rounded-lg"
                  key={responseId}
                >
                  <picture>
                    {/* biome-ignore lint/nursery/useImageSize: "Generated image" */}
                    <img
                      alt={userPrompt}
                      className="max-w-full rounded-lg"
                      src={imageUrl}
                    />
                  </picture>
                  <button
                    className="absolute right-2 bottom-2 flex size-8 items-center justify-center rounded-lg bg-black/50 text-white transition-opacity hover:bg-black/70 md:opacity-0 md:group-hover/image:opacity-100"
                    onClick={() => {
                      if (imageUrl) {
                        handleDownload(imageUrl);
                      } else {
                        toast({
                          type: "error",
                          description: t("downloadError"),
                        });
                      }
                    }}
                    title={t("download")}
                    type="button"
                  >
                    <DownloadIcon size={16} />
                  </button>
                </div>
              );
            }

            if (part.type === "data-videoGenerationFinish") {
              const { videoUrl, userPrompt, responseId } = part.data;

              const handleVideoDownload = async (propUrl: string) => {
                try {
                  await downloadFromUrl(propUrl, "generated-video.mp4");
                } catch {
                  toast({
                    type: "error",
                    description: t("downloadError"),
                  });
                }
              };

              return (
                <div
                  className="group/video relative overflow-hidden rounded-lg"
                  key={responseId}
                >
                  <video
                    className="max-w-full rounded-lg"
                    controls
                    playsInline
                    preload="metadata"
                    title={userPrompt}
                  >
                    <source src={videoUrl} type="video/mp4" />
                    <track kind="captions" />
                  </video>
                  <button
                    className="absolute right-2 bottom-2 flex size-8 items-center justify-center rounded-lg bg-black/50 text-white transition-opacity hover:bg-black/70 md:opacity-0 md:group-hover/video:opacity-100"
                    onClick={() => {
                      if (videoUrl) {
                        handleVideoDownload(videoUrl);
                      } else {
                        toast({
                          type: "error",
                          description: t("downloadError"),
                        });
                      }
                    }}
                    title={t("downloadVideo")}
                    type="button"
                  >
                    <DownloadIcon size={16} />
                  </button>
                </div>
              );
            }

            if (part.type === "text") {
              if (mode === "view") {
                return (
                  <div key={key}>
                    <MessageContent
                      className={cn({
                        "w-fit break-words rounded-lg rounded-br-xs bg-ink px-4 py-2.5 text-left text-paper shadow-sm":
                          message.role === "user",
                        "bg-transparent px-0 py-0 text-left":
                          message.role === "assistant",
                      })}
                      data-testid="message-content"
                    >
                      <Response>{sanitizeText(part.text)}</Response>
                    </MessageContent>
                  </div>
                );
              }

              if (mode === "edit") {
                return (
                  <div
                    className="flex w-full flex-row items-start gap-3"
                    key={key}
                  >
                    <div className="size-8" />
                    <div className="min-w-0 flex-1">
                      <MessageEditor
                        key={message.id}
                        message={message}
                        regenerate={regenerate}
                        setMessages={setMessages}
                        setMode={setMode}
                      />
                    </div>
                  </div>
                );
              }
            }

            return null;
          })}

          {!isReadonly && (
            <MessageActions
              chatId={chatId}
              isLastAssistantMessage={isLastAssistantMessage}
              isLoading={isLoading}
              key={`action-${message.id}`}
              message={message}
              regenerate={regenerate}
              setMode={setMode}
              vote={vote}
            />
          )}
        </div>
      </div>
    </motion.div>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) {
      return false;
    }
    if (prevProps.message.id !== nextProps.message.id) {
      return false;
    }
    if (prevProps.requiresScrollPadding !== nextProps.requiresScrollPadding) {
      return false;
    }
    if (!equal(prevProps.message.parts, nextProps.message.parts)) {
      return false;
    }
    if (!equal(prevProps.message.metadata, nextProps.message.metadata)) {
      return false;
    }
    if (!equal(prevProps.vote, nextProps.vote)) {
      return false;
    }
    if (prevProps.isLastAssistantMessage !== nextProps.isLastAssistantMessage) {
      return false;
    }

    return false;
  }
);

type ThinkingMessageProps = {
  modelId?: string;
};

export const ThinkingMessage = ({ modelId }: ThinkingMessageProps) => {
  const t = useTranslations("chat.messages");
  const role = "assistant";

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="group/message w-full"
      data-role={role}
      data-testid="message-assistant-loading"
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
      initial={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-start justify-start gap-3">
        <AssistantIcon isLoading={true} modelId={modelId} />

        <div className="flex w-full flex-col gap-2 md:gap-4">
          <div className="p-0 text-muted-foreground text-sm">
            {t("thinking")}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
