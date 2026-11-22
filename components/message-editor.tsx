"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { deleteTrailingMessages } from "@/app/(chat)/actions";
import { useTranslations } from "@/lib/i18n/translate";
import type { ChatMessage } from "@/lib/types";
import { getTextFromMessage } from "@/lib/utils";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

export type MessageEditorProps = {
  message: ChatMessage;
  setMode: Dispatch<SetStateAction<"view" | "edit">>;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
};

export function MessageEditor({
  message,
  setMode,
  setMessages,
  regenerate,
}: MessageEditorProps) {
  const t = useTranslations("common.toasts");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [draftContent, setDraftContent] = useState<string>(
    getTextFromMessage(message)
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
    }
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, [adjustHeight]);

  // Move focus into the editor on open (caret at the end) and hand it back to
  // whatever opened it (the message's Edit button) once the editor closes.
  // The ref keeps the opener across Strict Mode's effect re-run, when the
  // textarea already holds focus.
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    const { activeElement } = document;
    if (
      !openerRef.current &&
      activeElement instanceof HTMLElement &&
      activeElement !== textarea
    ) {
      openerRef.current = activeElement;
    }
    textarea?.focus();
    textarea?.setSelectionRange(textarea.value.length, textarea.value.length);

    return () => {
      const hasFocusDropped =
        !document.activeElement || document.activeElement === document.body;
      if (hasFocusDropped && openerRef.current?.isConnected) {
        openerRef.current.focus();
      }
    };
  }, []);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraftContent(event.target.value);
    adjustHeight();
  };

  return (
    <div className="flex w-full flex-col gap-2">
      <Textarea
        className="w-full resize-none overflow-hidden rounded-xl bg-transparent text-base! outline-hidden"
        data-testid="message-editor"
        onChange={handleInput}
        ref={textareaRef}
        value={draftContent}
      />

      <div className="flex flex-row justify-end gap-2">
        <Button
          className="h-fit px-3 py-2"
          onClick={() => {
            setMode("view");
          }}
          variant="outline"
        >
          Cancel
        </Button>
        <Button
          className="h-fit px-3 py-2"
          data-testid="message-editor-send-button"
          disabled={isSubmitting}
          onClick={async () => {
            setIsSubmitting(true);

            try {
              await deleteTrailingMessages({
                id: message.id,
              });
            } catch {
              // Keep the editor open so the user does not lose the draft.
              toast.error(t("messageEditFailed"));
              setIsSubmitting(false);
              return;
            }

            setMessages((messages) => {
              const index = messages.findIndex((m) => m.id === message.id);

              if (index !== -1) {
                const updatedMessage: ChatMessage = {
                  ...message,
                  parts: [{ type: "text", text: draftContent }],
                };

                return [...messages.slice(0, index), updatedMessage];
              }

              return messages;
            });

            setMode("view");
            regenerate();
          }}
          variant="default"
        >
          {isSubmitting ? "Sending..." : "Send"}
        </Button>
      </div>
    </div>
  );
}
