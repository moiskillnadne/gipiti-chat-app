"use client";
import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { memo, useState } from "react";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { cn, sanitizeText } from "@/lib/utils";
import { DocumentToolResult } from "./document";
import { DocumentPreview } from "./document-preview";
import { MessageContent } from "./elements/message";
import { Response } from "./elements/response";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "./elements/tool";
import { AssistantIcon } from "./assistant-icon";
import { DownloadIcon } from "./icons";
import { MessageActions } from "./message-actions";
import { MessageEditor } from "./message-editor";
import { MessageReasoning } from "./message-reasoning";
import { PreviewAttachment } from "./preview-attachment";
import { toast } from "./toast";
import { UrlExtractInputPreview } from "./url-extract-input-preview";
import { UrlExtractResult } from "./url-extract-result";
import { Weather } from "./weather";
import { WebSearchInputPreview } from "./web-search-input-preview";
import { WebSearchResult } from "./web-search-result";

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
  return undefined;
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
          <AssistantIcon isLoading={isLoading} modelId={getModelIdFromMessage(message)} />
        )}

        <div
          className={cn("flex flex-col", {
            "gap-2 md:gap-4": message.parts?.some(
              (p) => p.type === "text" && p.text?.trim()
            ),
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

          {message.parts?.map((part, index) => {
            const { type } = part;
            const key = `message-${message.id}-part-${index}`;

            if (type === "reasoning") {
              const reasoningText = part.text ?? "";
              const hasReasoningText = reasoningText.trim().length > 0;

              if (!hasReasoningText && !isLoading) {
                return null;
              }

              return (
                <MessageReasoning
                  isLoading={isLoading}
                  key={key}
                  reasoning={reasoningText}
                />
              );
            }

            if (type === "data-imageGenerationFinish") {
              const { imageUrl, userPrompt, responseId } = part.data;

              const handleDownload = async (propUrl: string) => {
                const response = await fetch(propUrl);
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                const filename =
                  propUrl.split("/").pop() ?? "generated-image.png";
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
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

            if (type === "text") {
              if (mode === "view") {
                return (
                  <div key={key}>
                    <MessageContent
                      className={cn({
                        "w-fit break-all rounded-2xl px-3 py-2 text-left text-white":
                          message.role === "user",
                        "bg-transparent px-0 py-0 text-left":
                          message.role === "assistant",
                      })}
                      data-testid="message-content"
                      style={
                        message.role === "user"
                          ? { backgroundColor: "#006cff" }
                          : undefined
                      }
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

            if (type === "tool-getWeather") {
              const { toolCallId, state } = part;

              return (
                <Tool defaultOpen={true} key={toolCallId}>
                  <ToolHeader state={state} type="tool-getWeather" />
                  <ToolContent>
                    {state === "input-available" && (
                      <ToolInput input={part.input} />
                    )}
                    {state === "output-available" && (
                      <ToolOutput
                        errorText={undefined}
                        output={<Weather weatherAtLocation={part.output} />}
                      />
                    )}
                  </ToolContent>
                </Tool>
              );
            }

            if (type === "tool-createDocument") {
              const { toolCallId } = part;

              if (part.output && "error" in part.output) {
                return (
                  <div
                    className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
                    key={toolCallId}
                  >
                    {t("errorCreatingDocument")}: {String(part.output.error)}
                  </div>
                );
              }

              return (
                <DocumentPreview
                  isReadonly={isReadonly}
                  key={toolCallId}
                  result={part.output}
                />
              );
            }

            if (type === "tool-updateDocument") {
              const { toolCallId } = part;

              if (part.output && "error" in part.output) {
                return (
                  <div
                    className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
                    key={toolCallId}
                  >
                    {t("errorUpdatingDocument")}: {String(part.output.error)}
                  </div>
                );
              }

              return (
                <div className="relative" key={toolCallId}>
                  <DocumentPreview
                    args={{ ...part.output, isUpdate: true }}
                    isReadonly={isReadonly}
                    result={part.output}
                  />
                </div>
              );
            }

            if (type === "tool-requestSuggestions") {
              const { toolCallId, state } = part;

              return (
                <Tool defaultOpen={true} key={toolCallId}>
                  <ToolHeader state={state} type="tool-requestSuggestions" />
                  <ToolContent>
                    {state === "input-available" && (
                      <ToolInput input={part.input} />
                    )}
                    {state === "output-available" && (
                      <ToolOutput
                        errorText={undefined}
                        output={
                          "error" in part.output ? (
                            <div className="rounded border p-2 text-red-500">
                              Error: {String(part.output.error)}
                            </div>
                          ) : (
                            <DocumentToolResult
                              isReadonly={isReadonly}
                              result={part.output}
                              type="request-suggestions"
                            />
                          )
                        }
                      />
                    )}
                  </ToolContent>
                </Tool>
              );
            }

            if (type === "tool-webSearch") {
              const { state, toolCallId } = part;

              return (
                <div className="my-2" key={toolCallId}>
                  {state === "input-available" && (
                    <WebSearchInputPreview query={part.input.query} />
                  )}
                  {state === "output-available" &&
                    ("error" in part.output ? (
                      <div className="rounded border p-2 text-red-500">
                        Error: {String(part.output.error)}
                      </div>
                    ) : (
                      <WebSearchResult
                        cached={part.output.cached}
                        query={part.output.query}
                        responseTime={part.output.responseTime}
                        results={part.output.results}
                      />
                    ))}
                </div>
              );
            }

            if (type === "tool-extractUrl") {
              const { state, toolCallId } = part;

              return (
                <div className="my-2" key={toolCallId}>
                  {state === "input-available" && (
                    <UrlExtractInputPreview urls={part.input.urls} />
                  )}
                  {state === "output-available" &&
                    ("error" in part.output ? (
                      <div className="rounded border p-2 text-red-500">
                        Error: {String(part.output.error)}
                      </div>
                    ) : (
                      <UrlExtractResult results={part.output.results} />
                    ))}
                </div>
              );
            }

            if (type === "tool-generateImage") {
              const { toolCallId, state } = part;

              const handleDownload = async (imageUrl: string) => {
                const response = await fetch(imageUrl);
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                const filename =
                  imageUrl.split("/").pop() ?? "generated-image.png";
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
              };

              return (
                <div
                  className="group/image relative overflow-hidden rounded-lg"
                  key={toolCallId}
                >
                  {state === "output-available" && part.output.imageUrl ? (
                    <>
                      <picture>
                        {/* biome-ignore lint/nursery/useImageSize: "Generated image" */}
                        <img
                          alt={part.input.prompt}
                          className="max-w-full rounded-lg"
                          src={part.output.imageUrl}
                        />
                      </picture>
                      <button
                        className="absolute right-2 bottom-2 flex size-8 items-center justify-center rounded-lg bg-black/50 text-white transition-opacity hover:bg-black/70 md:opacity-0 md:group-hover/image:opacity-100"
                        onClick={() => {
                          if (part.output.imageUrl) {
                            handleDownload(part.output.imageUrl);
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
                    </>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg border p-4 text-muted-foreground">
                      <span className="animate-pulse">
                        {t("generatingImage")}
                      </span>
                    </div>
                  )}
                </div>
              );
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
