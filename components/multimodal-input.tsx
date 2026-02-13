"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  type ChangeEvent,
  type Dispatch,
  memo,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useSessionStorage, useWindowSize } from "usehooks-ts";
import { useModel } from "@/contexts/model-context";
import { useProject } from "@/contexts/project-context";
import { useStyle } from "@/contexts/style-context";
import {
  getModelById,
  supportsAttachments,
  supportsThinkingConfig,
  type ThinkingSetting,
} from "@/lib/ai/models";
import { myProvider } from "@/lib/ai/providers";
import type { Attachment, ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { cn } from "@/lib/utils";
import { Context } from "./elements/context";
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "./elements/prompt-input";
import {
  ArrowUpIcon,
  CheckCircleFillIcon,
  FolderIcon,
  PaperclipIcon,
  PenIcon,
  SparklesIcon,
  StopIcon,
} from "./icons";
import { PreviewAttachment } from "./preview-attachment";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";

type ToolsPopoverView = "menu" | "thinking" | "style" | "project";

function PureToolsPopover() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ToolsPopoverView>("menu");

  const tInput = useTranslations("chat.input");
  const tThinking = useTranslations("thinkingSetting");
  const tStyles = useTranslations("textStyles");
  const tProjects = useTranslations("projects");

  const { currentModelId, currentThinkingSetting, setCurrentThinkingSetting } =
    useModel();
  const {
    currentStyleId,
    setStyleId,
    styles,
    isLoading: isStylesLoading,
  } = useStyle();
  const {
    currentProjectId,
    setProjectId,
    projects,
    isLoading: isProjectsLoading,
  } = useProject();

  const isThinkingSupported = supportsThinkingConfig(currentModelId);
  const model = getModelById(currentModelId);
  const thinkingConfig = model?.thinkingConfig;

  const currentStyle = styles.find((s) => s.id === currentStyleId);
  const currentProject = projects.find((p) => p.id === currentProjectId);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setView("menu");
    }
  }, []);

  const getCurrentThinkingLabel = useCallback(() => {
    if (!currentThinkingSetting || !thinkingConfig) {
      return tThinking("default");
    }
    if (
      thinkingConfig.type === "effort" &&
      currentThinkingSetting.type === "effort"
    ) {
      return tThinking(currentThinkingSetting.value);
    }
    if (
      thinkingConfig.type === "budget" &&
      currentThinkingSetting.type === "budget"
    ) {
      const preset = thinkingConfig.presets.find(
        (p) => p.value === currentThinkingSetting.value
      );
      return preset ? tThinking(preset.label) : tThinking("default");
    }
    return tThinking("default");
  }, [currentThinkingSetting, thinkingConfig, tThinking]);

  const handleThinkingSelect = useCallback(
    (setting: ThinkingSetting) => {
      setCurrentThinkingSetting(setting);
      setOpen(false);
      setView("menu");
    },
    [setCurrentThinkingSetting]
  );

  const handleStyleChange = useCallback(
    (value: string) => {
      setStyleId(value === "none" ? null : value);
      setOpen(false);
      setView("menu");
    },
    [setStyleId]
  );

  const handleProjectChange = useCallback(
    (value: string) => {
      setProjectId(value === "none" ? null : value);
      setOpen(false);
      setView("menu");
    },
    [setProjectId]
  );

  const hasStyles = !isStylesLoading && styles.length > 0;
  const hasProjects = !isProjectsLoading && projects.length > 0;

  return (
    <Popover onOpenChange={handleOpenChange} open={open}>
      <PopoverTrigger asChild>
        <Button
          className="aspect-square h-8 rounded-lg p-1 transition-colors hover:bg-accent"
          variant="ghost"
        >
          <SlidersHorizontalIcon size={14} style={{ width: 14, height: 14 }} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[280px] rounded-2xl p-0 shadow-lg"
        side="top"
      >
        {view === "menu" && (
          <div className="flex flex-col">
            {isThinkingSupported && (
              <button
                className={cn(
                  "flex min-h-[44px] w-full cursor-pointer items-center",
                  "gap-3 px-3 py-2.5 text-left",
                  "transition-colors hover:bg-accent"
                )}
                onClick={() => setView("thinking")}
                type="button"
              >
                <SparklesIcon size={16} />
                <div className="flex-1">
                  <div className="font-medium text-sm leading-tight">
                    {tInput("toolsThinking")}
                  </div>
                  <div className="mt-0.5 text-muted-foreground text-xs">
                    {getCurrentThinkingLabel()}
                  </div>
                </div>
                <ChevronRightIcon className="text-muted-foreground" size={16} />
              </button>
            )}

            <button
              className={cn(
                "flex min-h-[44px] w-full cursor-pointer items-center",
                "gap-3 px-3 py-2.5 text-left",
                "transition-colors hover:bg-accent",
                isThinkingSupported && "border-border border-t"
              )}
              onClick={() => setView("style")}
              type="button"
            >
              <PenIcon size={16} />
              <div className="flex-1">
                <div className="font-medium text-sm leading-tight">
                  {tInput("toolsStyle")}
                </div>
                <div className="mt-0.5 text-muted-foreground text-xs">
                  {currentStyle?.name ?? tStyles("noStyle")}
                </div>
              </div>
              <ChevronRightIcon className="text-muted-foreground" size={16} />
            </button>

            <button
              className={cn(
                "flex min-h-[44px] w-full cursor-pointer items-center",
                "gap-3 border-border border-t px-3 py-2.5 text-left",
                "transition-colors hover:bg-accent"
              )}
              onClick={() => setView("project")}
              type="button"
            >
              <FolderIcon size={16} />
              <div className="flex-1">
                <div className="font-medium text-sm leading-tight">
                  {tInput("toolsProject")}
                </div>
                <div className="mt-0.5 text-muted-foreground text-xs">
                  {currentProject?.name ?? tProjects("noProject")}
                </div>
              </div>
              <ChevronRightIcon className="text-muted-foreground" size={16} />
            </button>
          </div>
        )}

        {view === "thinking" && thinkingConfig && (
          <div className="flex flex-col">
            <button
              className={cn(
                "flex min-h-[40px] w-full cursor-pointer items-center",
                "gap-2 border-border border-b px-3 py-2 text-left",
                "transition-colors hover:bg-accent"
              )}
              onClick={() => setView("menu")}
              type="button"
            >
              <ChevronLeftIcon size={16} />
              <span className="font-medium text-sm">
                {tInput("toolsThinking")}
              </span>
            </button>
            <div className="flex flex-col gap-px py-1">
              {thinkingConfig.type === "effort"
                ? thinkingConfig.values.map((value) => {
                    const isSelected =
                      currentThinkingSetting?.type === "effort" &&
                      currentThinkingSetting.value === value;
                    return (
                      <button
                        className={cn(
                          "flex min-h-[40px] w-full cursor-pointer items-center",
                          "gap-3 px-3 py-2 text-left",
                          "transition-colors hover:bg-accent",
                          isSelected && "bg-accent/50"
                        )}
                        key={value}
                        onClick={() =>
                          handleThinkingSelect({ type: "effort", value })
                        }
                        type="button"
                      >
                        <div className="flex-1 font-medium text-sm">
                          {tThinking(value)}
                        </div>
                        {isSelected && (
                          <span className="flex-shrink-0 text-primary">
                            <CheckCircleFillIcon size={18} />
                          </span>
                        )}
                      </button>
                    );
                  })
                : thinkingConfig.presets.map((preset) => {
                    const isSelected =
                      currentThinkingSetting?.type === "budget" &&
                      currentThinkingSetting.value === preset.value;
                    return (
                      <button
                        className={cn(
                          "flex min-h-[40px] w-full cursor-pointer items-center",
                          "gap-3 px-3 py-2 text-left",
                          "transition-colors hover:bg-accent",
                          isSelected && "bg-accent/50"
                        )}
                        key={preset.value}
                        onClick={() =>
                          handleThinkingSelect({
                            type: "budget",
                            value: preset.value,
                          })
                        }
                        type="button"
                      >
                        <div className="flex-1 font-medium text-sm">
                          {tThinking(preset.label)}
                        </div>
                        {isSelected && (
                          <span className="flex-shrink-0 text-primary">
                            <CheckCircleFillIcon size={18} />
                          </span>
                        )}
                      </button>
                    );
                  })}
            </div>
          </div>
        )}

        {view === "style" && (
          <div className="flex flex-col">
            <button
              className={cn(
                "flex min-h-[40px] w-full cursor-pointer items-center",
                "gap-2 border-border border-b px-3 py-2 text-left",
                "transition-colors hover:bg-accent"
              )}
              onClick={() => setView("menu")}
              type="button"
            >
              <ChevronLeftIcon size={16} />
              <span className="font-medium text-sm">
                {tInput("toolsStyle")}
              </span>
            </button>
            {hasStyles ? (
              <>
                <div className="max-h-[320px] overflow-y-scroll">
                  <RadioGroup
                    className="gap-0"
                    onValueChange={handleStyleChange}
                    value={currentStyleId ?? "none"}
                  >
                    <label
                      className={cn(
                        "group flex min-h-[44px] cursor-pointer items-start",
                        "gap-3 px-3 py-2.5 transition-colors hover:bg-accent",
                        !currentStyleId && "bg-accent/50"
                      )}
                      htmlFor="tools-style-none"
                    >
                      <RadioGroupItem
                        className="sr-only"
                        id="tools-style-none"
                        value="none"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm leading-tight">
                          {tStyles("noStyle")}
                        </div>
                        <div className="mt-0.5 text-muted-foreground text-xs leading-snug">
                          {tStyles("noStyleDescription")}
                        </div>
                      </div>
                      {!currentStyleId && (
                        <span className="mt-0.5 flex-shrink-0 text-primary">
                          <CheckCircleFillIcon size={18} />
                        </span>
                      )}
                    </label>

                    <div className="border-border border-t" />

                    {styles.map((style) => {
                      const isSelected = currentStyleId === style.id;
                      return (
                        <label
                          className={cn(
                            "group flex min-h-[44px] cursor-pointer",
                            "items-start gap-3 px-3 py-2.5",
                            "transition-colors hover:bg-accent",
                            isSelected && "bg-accent/50"
                          )}
                          htmlFor={`tools-style-${style.id}`}
                          key={style.id}
                        >
                          <RadioGroupItem
                            className="sr-only"
                            id={`tools-style-${style.id}`}
                            value={style.id}
                          />
                          <div className="flex-1">
                            <div className="font-medium text-sm leading-tight">
                              {style.name}
                            </div>
                            <div className="mt-0.5 text-muted-foreground text-xs leading-snug">
                              {tStyles("exampleCount", {
                                count: style.examples.length,
                              })}
                            </div>
                          </div>
                          {isSelected && (
                            <span className="mt-0.5 flex-shrink-0 text-primary">
                              <CheckCircleFillIcon size={18} />
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </RadioGroup>
                </div>
                <div className="border-border border-t px-3 py-2">
                  <Link
                    className="text-muted-foreground text-xs hover:text-foreground hover:underline"
                    href="/styles"
                    onClick={() => handleOpenChange(false)}
                  >
                    {tStyles("manageStyles")}
                  </Link>
                </div>
              </>
            ) : (
              <div className="px-3 py-4 text-center">
                <p className="text-muted-foreground text-sm">
                  {tStyles("noStylesYetShort")}
                </p>
                <Link
                  className="mt-2 inline-block text-primary text-sm hover:underline"
                  href="/styles"
                  onClick={() => handleOpenChange(false)}
                >
                  {tStyles("manageStyles")}
                </Link>
              </div>
            )}
          </div>
        )}

        {view === "project" && (
          <div className="flex flex-col">
            <button
              className={cn(
                "flex min-h-[40px] w-full cursor-pointer items-center",
                "gap-2 border-border border-b px-3 py-2 text-left",
                "transition-colors hover:bg-accent"
              )}
              onClick={() => setView("menu")}
              type="button"
            >
              <ChevronLeftIcon size={16} />
              <span className="font-medium text-sm">
                {tInput("toolsProject")}
              </span>
            </button>
            {hasProjects ? (
              <>
                <div className="max-h-[320px] overflow-y-scroll">
                  <RadioGroup
                    className="gap-0"
                    onValueChange={handleProjectChange}
                    value={currentProjectId ?? "none"}
                  >
                    <label
                      className={cn(
                        "group flex min-h-[44px] cursor-pointer items-start",
                        "gap-3 px-3 py-2.5 transition-colors hover:bg-accent",
                        !currentProjectId && "bg-accent/50"
                      )}
                      htmlFor="tools-project-none"
                    >
                      <RadioGroupItem
                        className="sr-only"
                        id="tools-project-none"
                        value="none"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm leading-tight">
                          {tProjects("noProject")}
                        </div>
                        <div className="mt-0.5 text-muted-foreground text-xs leading-snug">
                          {tProjects("noProjectDescription")}
                        </div>
                      </div>
                      {!currentProjectId && (
                        <span className="mt-0.5 flex-shrink-0 text-primary">
                          <CheckCircleFillIcon size={18} />
                        </span>
                      )}
                    </label>

                    <div className="border-border border-t" />

                    {projects.map((proj) => {
                      const isSelected = currentProjectId === proj.id;
                      return (
                        <label
                          className={cn(
                            "group flex min-h-[44px] cursor-pointer",
                            "items-start gap-3 px-3 py-2.5",
                            "transition-colors hover:bg-accent",
                            isSelected && "bg-accent/50"
                          )}
                          htmlFor={`tools-project-${proj.id}`}
                          key={proj.id}
                        >
                          <RadioGroupItem
                            className="sr-only"
                            id={`tools-project-${proj.id}`}
                            value={proj.id}
                          />
                          <div className="flex-1">
                            <div className="font-medium text-sm leading-tight">
                              {proj.name}
                            </div>
                            <div className="mt-0.5 text-muted-foreground text-xs leading-snug">
                              {tProjects("contextEntryCount", {
                                count: proj.contextEntries.length,
                              })}
                            </div>
                          </div>
                          {isSelected && (
                            <span className="mt-0.5 flex-shrink-0 text-primary">
                              <CheckCircleFillIcon size={18} />
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </RadioGroup>
                </div>
                <div className="border-border border-t px-3 py-2">
                  <Link
                    className="text-muted-foreground text-xs hover:text-foreground hover:underline"
                    href="/projects"
                    onClick={() => handleOpenChange(false)}
                  >
                    {tProjects("manageProjects")}
                  </Link>
                </div>
              </>
            ) : (
              <div className="px-3 py-4 text-center">
                <p className="text-muted-foreground text-sm">
                  {tProjects("noProjectsYetShort")}
                </p>
                <Link
                  className="mt-2 inline-block text-primary text-sm hover:underline"
                  href="/projects"
                  onClick={() => handleOpenChange(false)}
                >
                  {tProjects("manageProjects")}
                </Link>
              </div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

const ToolsPopover = memo(PureToolsPopover);

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
  usage,
}: {
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
  usage?: AppUsage;
}) {
  const t = useTranslations("common.toasts");
  const tInput = useTranslations("chat.input");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();

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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);

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

  const { currentModelId } = useModel();

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

          return {
            url,
            name: pathname,
            contentType,
          };
        }
        const { error } = await response.json();
        toast.error(error);
      } catch (_error) {
        toast.error(t("uploadFailed"));
      }
    },
    [t]
  );

  const _modelResolver = useMemo(() => {
    return myProvider.languageModel(currentModelId);
  }, [currentModelId]);

  const contextProps = useMemo(
    () => ({
      usage,
    }),
    [usage]
  );

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error("Error uploading files!", error);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, uploadFile]
  );

  return (
    <div className={cn("relative flex w-full flex-col gap-4", className)}>
      <input
        accept="image/jpeg,image/png,application/pdf"
        className="-top-4 -left-4 pointer-events-none fixed size-0.5 opacity-0"
        multiple
        onChange={handleFileChange}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />

      <PromptInput
        className="rounded-3xl border border-border bg-background p-3 shadow-xs transition-all duration-200 focus-within:border-border hover:border-muted-foreground/50"
        onSubmit={(event) => {
          event.preventDefault();
          if (status !== "ready") {
            toast.error(t("waitForResponse"));
          } else {
            submitForm();
          }
        }}
      >
        {(attachments.length > 0 || uploadQueue.length > 0) && (
          <div
            className="flex flex-row items-end gap-2 overflow-x-scroll"
            data-testid="attachments-preview"
          >
            {attachments.map((attachment) => (
              <PreviewAttachment
                attachment={attachment}
                key={attachment.url}
                onRemove={() => {
                  setAttachments((currentAttachments) =>
                    currentAttachments.filter((a) => a.url !== attachment.url)
                  );
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
              />
            ))}

            {uploadQueue.map((filename) => (
              <PreviewAttachment
                attachment={{
                  url: "",
                  name: filename,
                  contentType: "",
                }}
                isUploading={true}
                key={filename}
              />
            ))}
          </div>
        )}
        <div className="flex w-full flex-row items-start gap-1 sm:gap-2">
          <PromptInputTextarea
            autoFocus
            className="min-w-0 grow resize-none break-words border-0! border-none! bg-transparent p-2 text-base outline-none ring-0 [-ms-overflow-style:none] [scrollbar-width:none] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 [&::-webkit-scrollbar]:hidden"
            data-testid="multimodal-input"
            disableAutoResize={false}
            maxHeight={250}
            minHeight={44}
            onChange={handleInput}
            placeholder={tInput("placeholder")}
            ref={textareaRef}
            rows={1}
            value={input}
          />{" "}
          <Context {...contextProps} />
        </div>
        <PromptInputToolbar className="!border-top-0 border-t-0! p-0 shadow-none dark:border-0 dark:border-transparent!">
          <PromptInputTools className="gap-0 sm:gap-0.5">
            <AttachmentsButton fileInputRef={fileInputRef} status={status} />
            <ToolsPopover />
          </PromptInputTools>

          {status === "submitted" || status === "streaming" ? (
            <StopButton setMessages={setMessages} stop={stop} />
          ) : (
            <PromptInputSubmit
              className="size-8 rounded-full bg-primary text-primary-foreground transition-colors duration-200 hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
              data-testid="send-button"
              disabled={!input.trim() || uploadQueue.length > 0}
              status={status}
            >
              <ArrowUpIcon size={14} />
            </PromptInputSubmit>
          )}
        </PromptInputToolbar>
      </PromptInput>
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

function PureAttachmentsButton({
  fileInputRef,
  status,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: UseChatHelpers<ChatMessage>["status"];
}) {
  const { currentModelId } = useModel();
  const canAttachFiles = supportsAttachments(currentModelId);

  return (
    <Button
      className="aspect-square h-8 rounded-lg p-1 transition-colors hover:bg-accent"
      data-testid="attachments-button"
      disabled={status !== "ready" || !canAttachFiles}
      onClick={(event) => {
        event.preventDefault();
        fileInputRef.current?.click();
      }}
      variant="ghost"
    >
      <PaperclipIcon size={14} style={{ width: 14, height: 14 }} />
    </Button>
  );
}

const AttachmentsButton = memo(PureAttachmentsButton);

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
}) {
  return (
    <Button
      className="size-7 rounded-full bg-foreground p-1 text-background transition-colors duration-200 hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground"
      data-testid="stop-button"
      onClick={(event) => {
        event.preventDefault();
        stop();
        setMessages((messages) => messages);
      }}
    >
      <StopIcon size={14} />
    </Button>
  );
}

const StopButton = memo(PureStopButton);
