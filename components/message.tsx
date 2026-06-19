"use client";
import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { motion } from "framer-motion";
import { memo, useMemo, useState } from "react";
import { getModelById } from "@/lib/ai/models";
import type { Vote } from "@/lib/db/schema";
import { downloadFromUrl } from "@/lib/download";
import { useTranslations } from "@/lib/i18n/translate";
import { groupToolRuns } from "@/lib/messages/group-tool-runs";
import type { ChatMessage } from "@/lib/types";
import { cn, sanitizeText } from "@/lib/utils";
import { AssistantIcon } from "./assistant-icon";
import { MediaPreview, type MediaPreviewState } from "./elements/media-preview";
import { MessageContent } from "./elements/message";
import { PdfPreview } from "./elements/pdf-preview";
import { Response } from "./elements/response";
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

/**
 * Map an AI SDK tool-part lifecycle state to a MediaPreview state. A media tool
 * is "generating" until its output URL arrives, "done" once it does, and
 * "error" on failure (or a finished call with no URL).
 */
const mediaStateFromToolPart = (
  state: string,
  hasUrl: boolean
): MediaPreviewState => {
  if (state === "output-error" || (state === "output-available" && !hasUrl)) {
    return "error";
  }
  return hasUrl ? "done" : "generating";
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
  streamStartedAtMs,
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
  streamStartedAtMs: number | null;
}) => {
  const t = useTranslations("chat.messages");
  const tModels = useTranslations("modelList");
  const [mode, setMode] = useState<"view" | "edit">("view");

  // Resolve a human label for the media-preview model chip. getModelById maps
  // the model id to its translation key; a missing key returns the key itself
  // (contains "."), so we hide the chip in that case.
  const resolveModelLabel = (modelId: string): string | undefined => {
    const model = getModelById(modelId);
    if (!model) {
      return;
    }
    const label = tModels(model.name);
    return label.includes(".") ? undefined : label;
  };

  const downloadMedia = async (
    mediaUrl: string,
    mediaType: "image" | "video"
  ) => {
    try {
      await downloadFromUrl(
        mediaUrl,
        mediaType === "image" ? "generated-image.png" : "generated-video.mp4"
      );
    } catch {
      toast({ type: "error", description: t("downloadError") });
    }
  };

  const downloadPdf = async (pdfUrl: string, title?: string) => {
    try {
      await downloadFromUrl(pdfUrl, `${title?.trim() || "document"}.pdf`);
    } catch {
      toast({ type: "error", description: t("downloadFileError") });
    }
  };

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
          className={cn("flex min-w-0 flex-col", {
            "gap-2 md:gap-4":
              message.role === "assistant" ||
              message.parts?.some((p) => p.type === "text" && p.text?.trim()),
            "min-h-96": message.role === "assistant" && requiresScrollPadding,
            "w-full":
              (message.role === "assistant" &&
                message.parts?.some(
                  (p) =>
                    (p.type === "text" && p.text?.trim()) ||
                    p.type === "data-mediaGeneration" ||
                    p.type === "data-imageGenerationFinish" ||
                    p.type === "data-videoGenerationFinish" ||
                    p.type === "tool-generateImage" ||
                    p.type === "tool-generatePdf"
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
                  key={part.key}
                  streamStartedAtMs={streamStartedAtMs}
                />
              );
            }

            // Tool-generated media renders as a standalone card outside the
            // tool-run box (kept out of the run-group by groupToolRuns).
            if (part.type === "tool-generateImage") {
              const imageUrl =
                part.state === "output-available"
                  ? part.output?.imageUrl
                  : undefined;

              return (
                <MediaPreview
                  key={key}
                  mediaType="image"
                  onDownload={
                    imageUrl
                      ? () => downloadMedia(imageUrl, "image")
                      : undefined
                  }
                  prompt={part.input?.prompt}
                  state={mediaStateFromToolPart(part.state, Boolean(imageUrl))}
                  url={imageUrl}
                />
              );
            }

            if (part.type === "tool-generatePdf") {
              const pdfUrl =
                part.state === "output-available"
                  ? part.output?.pdfUrl
                  : undefined;
              const pdfTitle = part.input?.title;

              return (
                <PdfPreview
                  key={key}
                  onDownload={
                    pdfUrl ? () => downloadPdf(pdfUrl, pdfTitle) : undefined
                  }
                  state={mediaStateFromToolPart(part.state, Boolean(pdfUrl))}
                  title={pdfTitle}
                  url={pdfUrl}
                />
              );
            }

            if (part.type === "data-mediaGeneration") {
              const {
                documentId,
                mediaType,
                status,
                prompt,
                modelId,
                url,
                durationSeconds,
                errorMessage,
              } = part.data;

              return (
                <MediaPreview
                  durationSeconds={durationSeconds}
                  errorMessage={errorMessage}
                  key={documentId}
                  mediaType={mediaType}
                  modelLabel={resolveModelLabel(modelId)}
                  onDownload={
                    url ? () => downloadMedia(url, mediaType) : undefined
                  }
                  onRegenerate={isReadonly ? undefined : () => regenerate()}
                  prompt={prompt}
                  state={status}
                  url={url}
                />
              );
            }

            // Back-compat: historical messages persisted before the unified
            // mediaGeneration part still carry these finish parts.
            if (part.type === "data-imageGenerationFinish") {
              const { imageUrl, userPrompt, responseId } = part.data;

              return (
                <MediaPreview
                  key={responseId}
                  mediaType="image"
                  onDownload={
                    imageUrl
                      ? () => downloadMedia(imageUrl, "image")
                      : undefined
                  }
                  onRegenerate={isReadonly ? undefined : () => regenerate()}
                  prompt={userPrompt}
                  state="done"
                  url={imageUrl}
                />
              );
            }

            if (part.type === "data-videoGenerationFinish") {
              const { videoUrl, userPrompt, responseId, durationSeconds } =
                part.data;

              return (
                <MediaPreview
                  durationSeconds={durationSeconds}
                  key={responseId}
                  mediaType="video"
                  onDownload={
                    videoUrl
                      ? () => downloadMedia(videoUrl, "video")
                      : undefined
                  }
                  onRegenerate={isReadonly ? undefined : () => regenerate()}
                  prompt={userPrompt}
                  state="done"
                  url={videoUrl}
                />
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
                        "overflow-visible bg-transparent px-0 py-0 text-left":
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
