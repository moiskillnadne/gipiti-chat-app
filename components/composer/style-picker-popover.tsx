"use client";

import { Check, ChevronRight, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useStyle } from "@/contexts/style-context";
import { useTranslations } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import { resolveSwatchClass } from "@/lib/utils/swatch";
import {
  ChipRemoveButton,
  ChipWrapper,
  ContextChipTrigger,
} from "./context-chip";

export function StylePickerPopover() {
  const tInput = useTranslations("chat.input");
  const tStyles = useTranslations("textStyles");
  const { currentStyleId, setStyleId, styles } = useStyle();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const currentStyle = styles.find((style) => style.id === currentStyleId);

  const filteredStyles = useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery) {
      return styles;
    }
    return styles.filter((style) =>
      style.name.toLowerCase().includes(trimmedQuery)
    );
  }, [query, styles]);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <ChipWrapper empty={!currentStyle}>
        <PopoverTrigger asChild>
          <ContextChipTrigger
            empty={!currentStyle}
            kind="style"
            labelKey={tInput("stylePickerLabel")}
            swatchClass={
              currentStyle
                ? resolveSwatchClass(currentStyle.swatch, currentStyle.id)
                : null
            }
            value={currentStyle?.name ?? tInput("stylePickerEmpty")}
          />
        </PopoverTrigger>
        {currentStyle && (
          <ChipRemoveButton
            label={tInput("removeStyle")}
            onRemove={() => setStyleId(null)}
          />
        )}
      </ChipWrapper>
      <PopoverContent
        align="start"
        className="w-80 overflow-hidden rounded-lg border border-rule bg-card p-0 text-popover-foreground shadow-pop"
        onOpenAutoFocus={(event) => {
          if (typeof window === "undefined") {
            return;
          }
          const isDesktop = window.matchMedia("(min-width: 768px)").matches;
          if (!isDesktop) {
            event.preventDefault();
          }
        }}
        sideOffset={6}
      >
        <div className="flex items-center gap-2 border-rule border-b px-3 py-2.5">
          <Search className="size-3.5 text-ink-3" strokeWidth={1.6} />
          <input
            className="flex-1 border-none bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-4"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tInput("searchStyles")}
            value={query}
          />
          <kbd className="rounded border border-rule bg-paper-2 px-1.5 py-[2px] font-mono text-[9px] text-ink-4 uppercase tracking-[0.04em]">
            esc
          </kbd>
        </div>

        <div className="flex max-h-72 flex-col gap-px overflow-y-auto p-1.5">
          <div className="px-2.5 pt-1.5 pb-1 font-mono text-[9.5px] text-ink-4 uppercase tracking-[0.1em]">
            {tInput("yourStylesCount", { count: styles.length })}
          </div>

          {filteredStyles.length === 0 && (
            <div className="px-2.5 py-3 text-[12px] text-ink-3">
              {tStyles("noStylesYetShort")}
            </div>
          )}

          {filteredStyles.map((style) => {
            const isSelected = style.id === currentStyleId;
            return (
              <button
                className={cn(
                  "grid grid-cols-[18px_1fr_auto] items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors duration-fast ease-canon",
                  "hover:bg-paper-2",
                  isSelected && "bg-paper-2"
                )}
                key={style.id}
                onClick={() => {
                  setStyleId(style.id);
                  setOpen(false);
                }}
                type="button"
              >
                <span
                  aria-hidden
                  className={cn(
                    "relative inline-block size-4 shrink-0 rounded-[5px]",
                    resolveSwatchClass(style.swatch, style.id)
                  )}
                >
                  <span
                    aria-hidden
                    className="absolute inset-[3px] rounded-full border-[1.2px] border-ink/50 border-dashed"
                  />
                </span>
                <span className="flex min-w-0 flex-col gap-px">
                  <span className="truncate font-medium text-[13px] text-ink">
                    {style.name}
                  </span>
                  {style.description && (
                    <span className="truncate text-[11.5px] text-ink-3">
                      {style.description}
                    </span>
                  )}
                </span>
                {isSelected ? (
                  <Check className="size-3.5 text-ink" strokeWidth={2.4} />
                ) : style.isDefault ? (
                  <span className="font-mono text-[9.5px] text-ink-4 uppercase tracking-[0.06em]">
                    {tStyles("defaultBadge")}
                  </span>
                ) : (
                  <span />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 border-rule border-t bg-paper px-2.5 py-2">
          <Link
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
            href="/styles?create=1"
            onClick={() => setOpen(false)}
          >
            <Plus className="size-3" strokeWidth={1.8} />
            {tInput("newStyle")}
          </Link>
          <div className="flex-1" />
          <Link
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
            href="/styles"
            onClick={() => setOpen(false)}
          >
            {tInput("manageStyles")}
            <ChevronRight className="size-3" strokeWidth={1.8} />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
