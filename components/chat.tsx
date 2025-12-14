"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { format } from "date-fns";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { ChatHeader } from "@/components/chat-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { useArtifactSelector } from "@/hooks/use-artifact";
import { useAutoResume } from "@/hooks/use-auto-resume";
import {
  getDefaultThinkingSetting,
  type ThinkingSetting,
} from "@/lib/ai/models";
import type { Vote } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import type { Attachment, ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import {
  fetcher,
  fetchWithErrorHandlers,
  generateUUID,
  parseQuotaInfo,
} from "@/lib/utils";
import { Artifact } from "./artifact";
import { useDataStream } from "./data-stream-provider";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";
import { getChatHistoryPaginationKey } from "./sidebar-history";
import { toast } from "./toast";

export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialThinkingSetting,
  isReadonly,
  autoResume,
  initialLastContext,
}: {
  id: string;
  initialMessages: ChatMessage[];
  initialChatModel: string;
  initialThinkingSetting?: ThinkingSetting;
  isReadonly: boolean;
  autoResume: boolean;
  initialLastContext?: AppUsage;
}) {
  const { mutate } = useSWRConfig();
  const { setDataStream } = useDataStream();
  const t = useTranslations("chat");
  const tCommon = useTranslations("common");
  const tUsage = useTranslations("usage");

  const [input, setInput] = useState<string>("");
  const [usage, setUsage] = useState<AppUsage | undefined>(initialLastContext);
  const [showCreditCardAlert, setShowCreditCardAlert] = useState(false);
  const [showQuotaExceededDialog, setShowQuotaExceededDialog] = useState(false);
  const [quotaErrorInfo, setQuotaErrorInfo] =
    useState<ReturnType<typeof parseQuotaInfo>>(null);
  const [currentModelId, setCurrentModelId] = useState(initialChatModel);
  const currentModelIdRef = useRef(currentModelId);
  const [currentThinkingSetting, setCurrentThinkingSetting] = useState<
    ThinkingSetting | undefined
  >(initialThinkingSetting);
  const currentThinkingSettingRef = useRef(currentThinkingSetting);

  useEffect(() => {
    currentModelIdRef.current = currentModelId;
  }, [currentModelId]);

  useEffect(() => {
    currentThinkingSettingRef.current = currentThinkingSetting;
  }, [currentThinkingSetting]);

  const handleModelChange = useCallback((newModelId: string) => {
    setCurrentModelId(newModelId);
    const defaultSetting = getDefaultThinkingSetting(newModelId);
    setCurrentThinkingSetting(defaultSetting);
  }, []);

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    resumeStream,
  } = useChat<ChatMessage>({
    id,
    messages: initialMessages,
    experimental_throttle: 100,
    generateId: generateUUID,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest(request) {
        return {
          body: {
            id: request.id,
            message: request.messages.at(-1),
            selectedChatModel: currentModelIdRef.current,
            thinkingSetting: currentThinkingSettingRef.current,
            ...request.body,
          },
        };
      },
    }),
    onData: (dataPart) => {
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
      if (dataPart.type === "data-usage") {
        setUsage(dataPart.data);
      }
    },
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
    },
    onError: (error) => {
      console.error("Error in chat", error);
      if (error instanceof ChatSDKError) {
        // Handle quota exceeded
        if (error.type === "quota_exceeded") {
          const quotaInfo = parseQuotaInfo(error.cause as string);
          setQuotaErrorInfo(quotaInfo);
          setShowQuotaExceededDialog(true);
          return;
        }

        // Handle credit card errors
        if (
          error.message?.includes("AI Gateway requires a valid credit card")
        ) {
          setShowCreditCardAlert(true);
        } else {
          toast({
            type: "error",
            description: error.message,
          });
        }
      }
    },
  });

  const searchParams = useSearchParams();
  const query = searchParams.get("query");

  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);

  useEffect(() => {
    if (query && !hasAppendedQuery) {
      sendMessage({
        role: "user" as const,
        parts: [{ type: "text", text: query }],
      });

      setHasAppendedQuery(true);
      window.history.replaceState({}, "", `/chat/${id}`);
    }
  }, [query, sendMessage, hasAppendedQuery, id]);

  const { data: votes } = useSWR<Vote[]>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher
  );

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  useAutoResume({
    autoResume,
    initialMessages,
    resumeStream,
    setMessages,
  });

  return (
    <>
      <div className="overscroll-behavior-contain flex h-dvh min-w-0 touch-pan-y flex-col bg-background">
        <ChatHeader chatId={id} isReadonly={isReadonly} />

        <Messages
          chatId={id}
          isArtifactVisible={isArtifactVisible}
          isReadonly={isReadonly}
          messages={messages}
          regenerate={regenerate}
          selectedModelId={initialChatModel}
          setMessages={setMessages}
          status={status}
          votes={votes}
        />

        <div className="sticky bottom-0 z-1 mx-auto flex w-full max-w-4xl gap-2 border-t-0 bg-background px-2 pb-3 md:px-4 md:pb-4">
          {!isReadonly && (
            <MultimodalInput
              attachments={attachments}
              chatId={id}
              input={input}
              messages={messages}
              onModelChange={handleModelChange}
              onThinkingSettingChange={setCurrentThinkingSetting}
              selectedModelId={currentModelId}
              selectedThinkingSetting={currentThinkingSetting}
              sendMessage={sendMessage}
              setAttachments={setAttachments}
              setInput={setInput}
              setMessages={setMessages}
              status={status}
              stop={stop}
              usage={usage}
            />
          )}
        </div>
      </div>

      <Artifact
        attachments={attachments}
        chatId={id}
        input={input}
        isReadonly={isReadonly}
        messages={messages}
        regenerate={regenerate}
        selectedModelId={currentModelId}
        selectedThinkingSetting={currentThinkingSetting}
        sendMessage={sendMessage}
        setAttachments={setAttachments}
        setInput={setInput}
        setMessages={setMessages}
        status={status}
        stop={stop}
        votes={votes}
      />

      <AlertDialog
        onOpenChange={setShowCreditCardAlert}
        open={showCreditCardAlert}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate AI Gateway</AlertDialogTitle>
            <AlertDialogDescription>
              This application requires{" "}
              {process.env.NODE_ENV === "production" ? "the owner" : "you"} to
              activate Vercel AI Gateway.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                window.open(
                  "https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card",
                  "_blank"
                );
                window.location.href = "/";
              }}
            >
              Activate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        onOpenChange={setShowQuotaExceededDialog}
        open={showQuotaExceededDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("quota.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-4">
                <p>{t("quota.description")}</p>

                {quotaErrorInfo && (
                  <div className="space-y-2 rounded-lg bg-muted p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {t("quota.used")}
                      </span>
                      <span className="font-medium">
                        {quotaErrorInfo.used?.toLocaleString()} /{" "}
                        {quotaErrorInfo.quota?.toLocaleString()}{" "}
                        {tUsage("tokens")}
                      </span>
                    </div>

                    {quotaErrorInfo.percentUsed !== undefined && (
                      <Progress
                        className="h-2"
                        value={quotaErrorInfo.percentUsed}
                      />
                    )}

                    {quotaErrorInfo.periodEnd && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {t("quota.resetDate")}
                        </span>
                        <span className="font-medium">
                          {format(quotaErrorInfo.periodEnd, "LLL d, yyyy")}
                        </span>
                      </div>
                    )}

                    {quotaErrorInfo.planName && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {t("quota.currentPlan")}
                        </span>
                        <span className="font-medium">
                          {quotaErrorInfo.planName}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("buttons.close")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                window.location.href = "/subscription";
              }}
            >
              {t("quota.upgradeButton")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
