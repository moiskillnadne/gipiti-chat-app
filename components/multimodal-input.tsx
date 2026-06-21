"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import {
  type ChangeEvent,
  type Dispatch,
  type DragEvent,
  memo,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useSessionStorage, useWindowSize } from "usehooks-ts";
import { useModel } from "@/contexts/model-context";
import { useWebSearch } from "@/contexts/web-search-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSpendBanner } from "@/hooks/use-spend-banner";
import { supportsAttachments } from "@/lib/ai/models";
import { useTranslations } from "@/lib/i18n/translate";
import type { Attachment, ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { cn } from "@/lib/utils";
import { AttachMenu } from "./composer/attach-menu";
import { AttachmentItem, UploadingItem } from "./composer/attachment-item";
import { BalanceSpendBanner } from "./composer/balance-spend-banner";
import { DragOverlay } from "./composer/drag-overlay";
import { KeyboardHints } from "./composer/keyboard-hints";
import { ProjectPickerPopover } from "./composer/project-picker-popover";
import { ThinkPopover } from "./composer/think-popover";
import { WebSearchToggle } from "./composer/web-search-toggle";
import { PromptInputTextarea } from "./elements/prompt-input";
import { ArrowUpIcon, StopIcon } from "./icons";

type MultimodalInputProps = {
  chatId: string;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  status: UseChatHelpers<ChatMessage>["status"];
  stop: () => void;
  attachments: Attachment[];
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  className?: string;
  // Kept for backward compatibility with chat.tsx; usage UI is hidden in this redesign.
  usage?: AppUsage;
};

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  setMessages,
  sendMessage,
  className,
}: MultimodalInputProps) {
  const tCommon = useTranslations("common.toasts");
  const tInput = useTranslations("chat.input");
  const spendBanner = useSpendBanner();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLFormElement>(null);
  const dragCounterRef = useRef(0);
  const { width } = useWindowSize();
  const isMobile = useIsMobile();
  const { currentModelId } = useModel();
  const { isWebSearchEnabled, toggleWebSearch } = useWebSearch();
  const canAttachFiles = supportsAttachments(currentModelId);

  const [uploadQueue, setUploadQueue] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const resetHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "44px";
    }
  }, []);

  const [localStorageInput, setLocalStorageInput] = useSessionStorage(
    `input-${chatId}`,
    ""
  );

  const prevChatIdRef = useRef(chatId);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      if (textareaRef.current) {
        const domValue = textareaRef.current.value;
        const finalValue = domValue || localStorageInput || "";
        setInput(finalValue);
      }
      return;
    }

    if (prevChatIdRef.current !== chatId) {
      prevChatIdRef.current = chatId;
      setInput(localStorageInput);
      resetHeight();
    }
  }, [chatId, localStorageInput, setInput, resetHeight]);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
  };

  const submitForm = useCallback(() => {
    window.history.replaceState({}, "", `/chat/${chatId}`);

    sendMessage({
      role: "user",
      parts: [
        ...attachments.map((attachment) => ({
          type: "file" as const,
          url: attachment.url,
          name: attachment.name,
          mediaType: attachment.contentType,
        })),
        {
          type: "text",
          text: input,
        },
      ],
    });

    setAttachments([]);
    setLocalStorageInput("");
    resetHeight();
    setInput("");

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    input,
    setInput,
    attachments,
    sendMessage,
    setAttachments,
    setLocalStorageInput,
    width,
    chatId,
    resetHeight,
  ]);

  const uploadFile = useCallback(
    async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("/api/files/upload", {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          const { url, pathname, contentType } = data;
          return { url, name: pathname, contentType };
        }
        const { error } = await response.json();
        toast.error(error);
      } catch (_error) {
        toast.error(tCommon("uploadFailed"));
      }
    },
    [tCommon]
  );

  const processFileList = useCallback(
    async (files: File[]) => {
      if (files.length === 0) {
        return;
      }
      setUploadQueue(files.map((file) => file.name));
      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploaded = await Promise.all(uploadPromises);
        const successful = uploaded.filter(
          (attachment) => attachment !== undefined
        );
        setAttachments((current) => [...current, ...successful]);
      } catch (error) {
        console.error("Error uploading files!", error);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, uploadFile]
  );

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      await processFileList(files);
      if (event.target) {
        event.target.value = "";
      }
    },
    [processFileList]
  );

  const handleAttachPick = useCallback((accept: string) => {
    if (!fileInputRef.current) {
      return;
    }
    fileInputRef.current.setAttribute("accept", accept);
    fileInputRef.current.click();
  }, []);

  const handleDragEnter = useCallback(
    (event: DragEvent<HTMLFormElement>) => {
      if (!canAttachFiles) {
        return;
      }
      if (!event.dataTransfer?.types?.includes("Files")) {
        return;
      }
      event.preventDefault();
      dragCounterRef.current += 1;
      setIsDragging(true);
    },
    [canAttachFiles]
  );

  const handleDragLeave = useCallback(
    (event: DragEvent<HTMLFormElement>) => {
      if (!canAttachFiles) {
        return;
      }
      event.preventDefault();
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
      if (dragCounterRef.current === 0) {
        setIsDragging(false);
      }
    },
    [canAttachFiles]
  );

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLFormElement>) => {
      if (!canAttachFiles) {
        return;
      }
      if (event.dataTransfer?.types?.includes("Files")) {
        event.preventDefault();
      }
    },
    [canAttachFiles]
  );

  const handleDrop = useCallback(
    async (event: DragEvent<HTMLFormElement>) => {
      if (!canAttachFiles) {
        return;
      }
      event.preventDefault();
      dragCounterRef.current = 0;
      setIsDragging(false);
      const files = Array.from(event.dataTransfer?.files ?? []);
      await processFileList(files);
    },
    [canAttachFiles, processFileList]
  );

  const isStreaming = status === "submitted" || status === "streaming";
  const sendDisabled = !input.trim() || uploadQueue.length > 0;
  const showAttachmentRow = attachments.length > 0 || uploadQueue.length > 0;

  return (
    <div className={cn("relative flex w-full flex-col", className)}>
      <input
        accept="image/jpeg,image/png,image/webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="-top-4 -left-4 pointer-events-none fixed size-0.5 opacity-0"
        multiple
        onChange={handleFileChange}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />

      {spendBanner.isVisible && spendBanner.threshold !== null && (
        <BalanceSpendBanner
          onDismiss={spendBanner.dismiss}
          percent={spendBanner.percent}
          threshold={spendBanner.threshold}
        />
      )}

      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: drag-and-drop file upload requires drop handlers on the composer surface */}
      <form
        className={cn(
          "relative w-full overflow-visible rounded-[20px] border border-rule bg-card shadow-md transition-[border-color,box-shadow,background-color] duration-fast ease-canon",
          "focus-within:border-ink-3 focus-within:shadow-lg",
          spendBanner.isVisible && "rounded-t-none",
          isDragging &&
            "border-citrus-deep bg-citrus-soft shadow-[0_0_0_4px_var(--citrus-soft),var(--shadow-lg)]"
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onSubmit={(event) => {
          event.preventDefault();
          if (status !== "ready") {
            toast.error(tCommon("waitForResponse"));
            return;
          }
          submitForm();
        }}
        ref={containerRef}
      >
        <div className="flex flex-wrap items-center gap-2 px-3 pt-2.5">
          <ProjectPickerPopover />
        </div>

        {showAttachmentRow && (
          <div
            className="flex flex-wrap gap-2 px-3 pt-3"
            data-testid="attachments-preview"
          >
            {attachments.map((attachment) => (
              <AttachmentItem
                attachment={attachment}
                key={attachment.url}
                onRemove={() => {
                  setAttachments((current) =>
                    current.filter((a) => a.url !== attachment.url)
                  );
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
                removeLabel={tInput("removeAttachment")}
              />
            ))}
            {uploadQueue.map((filename) => (
              <UploadingItem
                filename={filename}
                key={filename}
                uploadingLabel={tInput("uploadingPercent", { percent: 60 })}
              />
            ))}
          </div>
        )}

        <PromptInputTextarea
          autoFocus
          className="min-w-0 grow resize-none border-0! border-none! bg-transparent px-4 pt-3 pb-1.5 text-[15px] text-ink leading-[1.6] outline-none ring-0 [-ms-overflow-style:none] [scrollbar-width:none] placeholder:text-ink-3 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 [&::-webkit-scrollbar]:hidden"
          data-testid="multimodal-input"
          disableAutoResize={false}
          disableKeyboardSubmit={isMobile}
          maxHeight={220}
          minHeight={26}
          onChange={handleInput}
          placeholder={tInput("placeholder")}
          ref={textareaRef}
          rows={1}
          value={input}
        />

        <div className="flex items-center gap-1 px-2.5 pt-2 pb-2.5">
          <AttachMenu
            disabled={status !== "ready" || !canAttachFiles}
            onPick={handleAttachPick}
          />
          <WebSearchToggle
            active={isWebSearchEnabled}
            onToggle={toggleWebSearch}
          />
          <ThinkPopover />
          <div className="flex-1" />

          {isStreaming ? (
            <button
              aria-label={tInput("stop")}
              className="inline-flex size-[34px] shrink-0 items-center justify-center rounded-full bg-ink text-paper transition-colors duration-fast ease-canon hover:bg-ink-2"
              data-testid="stop-button"
              onClick={(event) => {
                event.preventDefault();
                stop();
                setMessages((messages) => messages);
              }}
              type="button"
            >
              <StopIcon size={12} />
            </button>
          ) : (
            <button
              aria-label={tInput("send")}
              className={cn(
                "inline-flex size-[34px] shrink-0 items-center justify-center rounded-full bg-ink text-paper transition-[background-color,color,transform] duration-fast ease-canon",
                "hover:scale-[1.04] hover:bg-citrus hover:text-ink",
                sendDisabled &&
                  "pointer-events-none cursor-not-allowed bg-paper-2 text-ink-4 hover:scale-100 hover:bg-paper-2 hover:text-ink-4"
              )}
              data-testid="send-button"
              disabled={sendDisabled}
              type="submit"
            >
              <ArrowUpIcon size={14} />
            </button>
          )}
        </div>

        {isDragging && <DragOverlay />}
      </form>

      <KeyboardHints />
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) {
      return false;
    }
    if (prevProps.status !== nextProps.status) {
      return false;
    }
    if (!equal(prevProps.attachments, nextProps.attachments)) {
      return false;
    }
    return true;
  }
);
