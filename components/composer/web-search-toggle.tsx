"use client";

import { Globe } from "lucide-react";
import { useTranslations } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

type WebSearchToggleProps = {
  active: boolean;
  onToggle: () => void;
};

export function WebSearchToggle({ active, onToggle }: WebSearchToggleProps) {
  const tInput = useTranslations("chat.input");
  return (
    <button
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border border-transparent px-2.5 py-1.5 text-[12.5px] text-ink-2 leading-none transition-colors duration-fast ease-canon",
        "hover:bg-paper-2 hover:text-ink",
        active && "border-citrus bg-citrus-soft text-ink"
      )}
      onClick={onToggle}
      type="button"
    >
      <Globe className="size-3.5" strokeWidth={1.6} />
      <span>{tInput("webSearch")}</span>
    </button>
  );
}
