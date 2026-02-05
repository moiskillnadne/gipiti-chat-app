"use client";

import { BrainIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type MessageReasoningProps = {
  isLoading: boolean;
  summary: string | null;
};

export function MessageReasoning({
  isLoading,
  summary,
}: MessageReasoningProps) {
  const t = useTranslations("chat.messages");

  // Only show during streaming
  if (!isLoading) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-muted-foreground text-sm",
        "fade-in-0 slide-in-from-top-2 animate-in duration-200"
      )}
      data-testid="message-reasoning"
    >
      <BrainIcon className="size-4 animate-pulse" />
      <span className="italic">{summary || t("thinking")}</span>
    </div>
  );
}
