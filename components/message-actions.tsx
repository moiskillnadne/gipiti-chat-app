import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { RefreshCw } from "lucide-react";
import { memo } from "react";
import { toast } from "sonner";
import { useCopyToClipboard } from "usehooks-ts";
import type { VoteDto } from "@/client/shared/api/types";
import { useTranslations } from "@/lib/i18n/translate";
import type { ChatMessage } from "@/lib/types";
import { Action, Actions } from "./elements/actions";
import { CopyIcon, PencilEditIcon, ThumbDownIcon, ThumbUpIcon } from "./icons";
import { useMessageVote } from "./use-message-vote";

export function PureMessageActions({
  chatId,
  message,
  vote,
  isLoading,
  setMode,
  regenerate,
  isLastAssistantMessage,
}: {
  chatId: string;
  message: ChatMessage;
  vote: VoteDto | undefined;
  isLoading: boolean;
  setMode?: (mode: "view" | "edit") => void;
  regenerate?: UseChatHelpers<ChatMessage>["regenerate"];
  isLastAssistantMessage?: boolean;
}) {
  const t = useTranslations("common.toasts");
  const tMessages = useTranslations("chat.messages");
  const castVote = useMessageVote(chatId);
  const [_, copyToClipboard] = useCopyToClipboard();

  if (isLoading) {
    return null;
  }

  const textFromParts = message.parts
    ?.filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();

  const handleCopy = async () => {
    if (!textFromParts) {
      toast.error(t("noTextToCopy"));
      return;
    }

    await copyToClipboard(textFromParts);
    toast.success(t("copiedToClipboard"));
  };

  // User messages get edit (shown on hover, on focus and always on touch) and copy actions
  if (message.role === "user") {
    return (
      <Actions className="-mr-0.5 justify-end">
        <div className="relative">
          {setMode && (
            <Action
              className="-left-10 absolute top-0 opacity-0 transition-opacity focus-visible:opacity-100 group-focus-within/message:opacity-100 group-hover/message:opacity-100 [@media(hover:none)]:opacity-100"
              onClick={() => setMode("edit")}
              tooltip={tMessages("edit")}
            >
              <PencilEditIcon />
            </Action>
          )}
          <Action onClick={handleCopy} tooltip={tMessages("copy")}>
            <CopyIcon />
          </Action>
        </div>
      </Actions>
    );
  }

  return (
    <Actions className="-ml-0.5">
      <Action onClick={handleCopy} tooltip={tMessages("copy")}>
        <CopyIcon />
      </Action>

      <Action
        data-testid="message-upvote"
        disabled={vote?.isUpvoted}
        onClick={() =>
          castVote({
            messageId: message.id,
            isUpvoted: true,
            previousIsUpvoted: vote?.isUpvoted,
          })
        }
        tooltip={tMessages("upvoteResponse")}
      >
        <ThumbUpIcon />
      </Action>

      <Action
        data-testid="message-downvote"
        disabled={vote && !vote.isUpvoted}
        onClick={() =>
          castVote({
            messageId: message.id,
            isUpvoted: false,
            previousIsUpvoted: vote?.isUpvoted,
          })
        }
        tooltip={tMessages("downvoteResponse")}
      >
        <ThumbDownIcon />
      </Action>

      {isLastAssistantMessage && regenerate && (
        <Action
          data-testid="message-regenerate"
          onClick={() => regenerate()}
          tooltip={tMessages("tryAgain")}
        >
          <RefreshCw size={16} />
        </Action>
      )}
    </Actions>
  );
}

export const MessageActions = memo(
  PureMessageActions,
  (prevProps, nextProps) => {
    if (!equal(prevProps.vote, nextProps.vote)) {
      return false;
    }
    if (prevProps.isLoading !== nextProps.isLoading) {
      return false;
    }
    if (prevProps.isLastAssistantMessage !== nextProps.isLastAssistantMessage) {
      return false;
    }

    return true;
  }
);
