"use client";

import { getModelSpeedLevel, SPEED_LABEL_KEY } from "@/lib/ai/model-speed";
import type { ChatModel } from "@/lib/ai/models";
import type { TranslateFn } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

import { inferModelProvider, ModelDot } from "../model-dot";
import { SpeedGauge } from "./speed-gauge";

type ModelRowProps = {
  model: ChatModel;
  isSelected: boolean;
  query: string;
  onSelect: () => void;
  t: TranslateFn;
  tSpeed: TranslateFn;
};

export function ModelRow({
  model,
  isSelected,
  query,
  onSelect,
  t,
  tSpeed,
}: ModelRowProps) {
  const speedLevel = getModelSpeedLevel(model.id);
  const name = t(model.name);
  const description = t(model.description);

  return (
    <button
      aria-selected={isSelected}
      className={cn(
        "relative mx-1 grid w-[calc(100%-0.5rem)] grid-cols-[10px_1fr_auto] items-center gap-3 rounded-md px-3 py-2.5 text-left",
        "transition-colors duration-fast ease-canon hover:bg-paper-2",
        isSelected &&
          "before:-translate-y-1/2 before:absolute before:top-1/2 before:left-[-2px] before:h-[18px] before:w-[3px] before:rounded-sm before:bg-citrus-deep before:content-['']"
      )}
      data-testid={`model-option-${model.id}`}
      onClick={onSelect}
      role="option"
      type="button"
    >
      <ModelDot provider={inferModelProvider(model.id)} size="sm" />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span
          className="flex items-center gap-1.5 font-medium text-[13px] text-ink leading-tight"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: highlight is escaped server-side
          dangerouslySetInnerHTML={{ __html: highlightMatch(name, query) }}
        />
        <span className="truncate text-[11.5px] text-ink-3 leading-snug">
          {description}
        </span>
      </span>
      <SpeedGauge level={speedLevel} title={tSpeed(SPEED_LABEL_KEY[speedLevel])} />
    </button>
  );
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

function highlightMatch(name: string, query: string): string {
  const trimmed = query.trim();
  if (!trimmed) {
    return escapeHtml(name);
  }
  const lower = name.toLowerCase();
  const index = lower.indexOf(trimmed.toLowerCase());
  if (index < 0) {
    return escapeHtml(name);
  }
  const before = escapeHtml(name.slice(0, index));
  const match = escapeHtml(name.slice(index, index + trimmed.length));
  const after = escapeHtml(name.slice(index + trimmed.length));
  return `${before}<mark class="rounded-xs bg-citrus-soft text-citrus-deep px-px">${match}</mark>${after}`;
}
