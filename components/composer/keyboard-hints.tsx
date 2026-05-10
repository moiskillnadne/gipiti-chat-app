"use client";

import { useIsMac } from "@/hooks/use-is-mac";
import { useTranslations } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

type KeyboardHintsProps = {
  className?: string;
};

export function KeyboardHints({ className }: KeyboardHintsProps) {
  const tInput = useTranslations("chat.input");
  const isMac = useIsMac();
  const modKeyLabel = isMac ? "⌘" : "Ctrl";
  return (
    <div
      className={cn(
        "hidden items-center justify-center gap-1.5 pt-2 font-mono text-[10px] text-ink-3 uppercase tracking-[0.08em] md:flex",
        className
      )}
    >
      <kbd className="rounded-xs border border-rule bg-paper-2 px-1.5 py-px text-ink-2">
        ↵
      </kbd>
      <span>{tInput("kbdHintSend")}</span>
      <span className="px-1 text-ink-4">·</span>
      <kbd className="rounded-xs border border-rule bg-paper-2 px-1.5 py-px text-ink-2">
        ⇧
      </kbd>
      <span className="px-0.5">+</span>
      <kbd className="rounded-xs border border-rule bg-paper-2 px-1.5 py-px text-ink-2">
        ↵
      </kbd>
      <span>{tInput("kbdHintNewLine")}</span>
      <span className="px-1 text-ink-4">·</span>
      <kbd className="rounded-xs border border-rule bg-paper-2 px-1.5 py-px text-ink-2">
        {modKeyLabel}
      </kbd>
      <span className="px-0.5">+</span>
      <kbd className="rounded-xs border border-rule bg-paper-2 px-1.5 py-px text-ink-2">
        K
      </kbd>
      <span>{tInput("kbdHintModelSelector")}</span>
    </div>
  );
}
