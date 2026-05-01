"use client";

import { ChevronDownIcon } from "lucide-react";
import Image from "next/image";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Visual atoms for the unified "tool run" card. The smart wrapper that turns
 * grouped message parts into these primitives lives in
 * `components/tool-run-renderer.tsx`. This file is intentionally pure UI —
 * no data shaping, no message-part awareness, no translation lookups.
 */

const RECENT_STEPS_COUNT = 2;

const DOT_KEYS = ["dot-a", "dot-b", "dot-c"] as const;

export type ToolRunProps = ComponentProps<"div">;

export const ToolRun = ({ className, children, ...props }: ToolRunProps) => (
  <div
    className={cn(
      "not-prose w-full overflow-hidden rounded-md border border-rule bg-card transition-colors duration-fast ease-canon hover:border-rule-strong",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export type ToolRunHeaderProps = {
  title: ReactNode;
  meta: ReactNode;
  isStreaming: boolean;
  className?: string;
};

const AtomGlyph = ({ isStreaming }: { isStreaming: boolean }) => (
  <svg
    aria-hidden="true"
    className={cn(
      "size-3.5 shrink-0 text-citrus-deep",
      isStreaming && "animate-breathe"
    )}
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.8"
    viewBox="0 0 24 24"
  >
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const ToolRunHeader = ({
  title,
  meta,
  isStreaming,
  className,
}: ToolRunHeaderProps) => (
  <div
    className={cn(
      "flex items-center gap-2.5 border-rule border-b bg-gradient-to-b from-black/[0.005] to-transparent px-3.5 py-2.5",
      className
    )}
  >
    <AtomGlyph isStreaming={isStreaming} />
    <span className="font-medium text-[13px] text-ink leading-tight">
      {title}
    </span>
    <span className="ml-auto inline-flex flex-wrap items-center gap-2 font-mono text-[10px] text-ink-3 uppercase leading-none tracking-[0.08em]">
      {meta}
    </span>
  </div>
);

export const ToolRunMetaSeparator = () => <span className="text-ink-4">·</span>;

export type EarlierStepsToggleProps = {
  count: number;
  isOpen: boolean;
  onToggle: () => void;
  label: ReactNode;
  hint?: ReactNode;
};

export const EarlierStepsToggle = ({
  count,
  isOpen,
  onToggle,
  label,
  hint,
}: EarlierStepsToggleProps) => {
  if (count <= 0) {
    return null;
  }

  const dots = Math.min(count, 3);

  return (
    <button
      aria-expanded={isOpen}
      className="flex w-full items-center gap-2.5 border-rule border-b bg-paper-2 px-3.5 py-2.5 text-left font-mono text-[11px] text-ink-3 uppercase leading-none tracking-[0.06em] transition-colors duration-fast ease-canon hover:bg-paper-3 hover:text-ink-2"
      onClick={onToggle}
      type="button"
    >
      <span className="inline-flex gap-[3px]">
        {DOT_KEYS.slice(0, dots).map((dotKey) => (
          <span className="size-1 rounded-full bg-ink-4" key={dotKey} />
        ))}
      </span>
      <span className="font-medium">{label}</span>
      {hint && (
        <span className="text-ink-4 normal-case tracking-normal">{hint}</span>
      )}
      <ChevronDownIcon
        className={cn(
          "ml-auto size-3 text-ink-3 transition-transform duration-fast ease-canon",
          isOpen && "rotate-180"
        )}
      />
    </button>
  );
};

export type SourceChipData = {
  url: string;
  domain: string;
  faviconUrl: string;
};

export const SourceChip = ({ chip }: { chip: SourceChipData }) => (
  <a
    className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-card px-2 py-[2px] text-[10px] text-ink-2 transition-colors duration-fast ease-canon hover:border-rule-strong hover:text-ink"
    href={chip.url}
    rel="noopener noreferrer"
    target="_blank"
  >
    <Image
      alt=""
      className="size-2.5 rounded-sm"
      height={10}
      src={chip.faviconUrl}
      unoptimized
      width={10}
    />
    <span className="max-w-[140px] truncate">{chip.domain}</span>
  </a>
);

const SearchedGlyph = () => (
  <svg
    aria-hidden="true"
    className="size-4"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.6"
    viewBox="0 0 24 24"
  >
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const ThoughtGlyph = () => (
  <svg
    aria-hidden="true"
    className="size-4"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.6"
    viewBox="0 0 24 24"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </svg>
);

const DocGlyph = () => (
  <svg
    aria-hidden="true"
    className="size-4"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.6"
    viewBox="0 0 24 24"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M9 13h6M9 17h4" />
  </svg>
);

const ImageGlyph = () => (
  <svg
    aria-hidden="true"
    className="size-4"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.6"
    viewBox="0 0 24 24"
  >
    <rect height="18" rx="2" ry="2" width="18" x="3" y="3" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.5-3.5L9 21" />
  </svg>
);

const CalculatorGlyph = () => (
  <svg
    aria-hidden="true"
    className="size-4"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.6"
    viewBox="0 0 24 24"
  >
    <rect height="20" rx="2" width="16" x="4" y="2" />
    <path d="M8 6h8M8 11h8M8 15h2M14 15h2M8 19h2M14 19h2" />
  </svg>
);

const WeatherGlyph = () => (
  <svg
    aria-hidden="true"
    className="size-4"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.6"
    viewBox="0 0 24 24"
  >
    <path d="M17 18a4 4 0 0 0 0-8 6 6 0 0 0-11.7 1.5A4 4 0 0 0 6 18z" />
    <circle cx="8" cy="9" r="1.5" />
  </svg>
);

const SparkleGlyph = () => (
  <svg
    aria-hidden="true"
    className="size-4"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.6"
    viewBox="0 0 24 24"
  >
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
  </svg>
);

export type StepKind =
  | "thought"
  | "searched"
  | "extracted"
  | "calculated"
  | "weather"
  | "createDocument"
  | "updateDocument"
  | "requestSuggestions"
  | "generatedImage";

export type ToolRunStepProps = {
  kind: StepKind;
  isActive?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  verb: ReactNode;
  body: ReactNode;
  trailing?: ReactNode;
};

const KIND_GLYPH: Record<StepKind, () => ReactNode> = {
  thought: ThoughtGlyph,
  searched: SearchedGlyph,
  extracted: SearchedGlyph,
  calculated: CalculatorGlyph,
  weather: WeatherGlyph,
  createDocument: DocGlyph,
  updateDocument: DocGlyph,
  requestSuggestions: SparkleGlyph,
  generatedImage: ImageGlyph,
};

const HIGHLIGHT_KINDS = new Set<StepKind>(["thought"]);

export const ToolRunStep = ({
  kind,
  isActive = false,
  isFirst = false,
  isLast = false,
  verb,
  body,
  trailing,
}: ToolRunStepProps) => {
  const Glyph = KIND_GLYPH[kind];
  const usesAccent = HIGHLIGHT_KINDS.has(kind);

  return (
    <div className="relative flex items-start gap-3 px-3.5 py-2.5 text-[13px] text-ink-2 [&+&]:border-rule [&+&]:border-t">
      <div className="relative flex w-[18px] shrink-0 items-center justify-center pt-0.5">
        {!isFirst && (
          <span className="-translate-x-1/2 absolute top-[-11px] bottom-1/2 left-1/2 w-px bg-rule" />
        )}
        {!isLast && (
          <span className="-translate-x-1/2 absolute top-1/2 bottom-[-11px] left-1/2 w-px bg-rule" />
        )}
        <span
          className={cn(
            "relative z-10 inline-flex size-4 items-center justify-center rounded-full bg-card",
            usesAccent ? "text-citrus-deep" : "text-ink-3",
            isActive && "animate-breathe text-citrus-deep"
          )}
        >
          <Glyph />
        </span>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="text-[13px] text-ink leading-snug">
          <span className="font-normal text-ink-3">{verb}</span> {body}
        </div>
      </div>
      {trailing && (
        <span
          className={cn(
            "shrink-0 pt-0.5 font-mono text-[10px]",
            isActive ? "text-citrus-deep" : "text-ink-4"
          )}
        >
          {trailing}
        </span>
      )}
    </div>
  );
};

/**
 * Inline `<q>` for queries — picks up curly quotes via CSS so tool-run rows
 * stay one-line clean. Uses ink for the query body and lighter ink for the
 * surrounding marks, matching the design.
 */
export const StepQuery = ({ children }: { children: ReactNode }) => (
  <q className="text-ink not-italic before:text-ink-3 before:content-[open-quote] after:text-ink-3 after:content-[close-quote]">
    {children}
  </q>
);

/**
 * Wrapper for a step's expanded body content — used when the step needs to
 * embed a richer widget (DocumentPreview, generated image, etc.) under the
 * one-line summary. Indents under the verb column.
 */
export const StepBody = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => <div className={cn("mt-1.5 max-w-full", className)}>{children}</div>;

/**
 * Source chip strip displayed inline under a search/extract step.
 */
export const StepSources = ({ chips }: { chips: SourceChipData[] }) => {
  if (chips.length === 0) {
    return null;
  }
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {chips.map((chip) => (
        <SourceChip chip={chip} key={chip.url} />
      ))}
    </div>
  );
};

export { RECENT_STEPS_COUNT };
