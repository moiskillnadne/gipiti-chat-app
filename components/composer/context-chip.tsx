"use client";

import { X } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export type ContextChipKind = "style" | "project";

type ContextChipTriggerProps = {
  kind: ContextChipKind;
  labelKey: string;
  value: ReactNode;
  swatchClass?: string | null;
  empty?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type">;

/**
 * Visual chip trigger. Used as the immediate child of `<PopoverTrigger asChild>`.
 * Render <ChipRemoveButton /> as a sibling inside <ChipWrapper /> when the value is committed.
 */
export const ContextChipTrigger = forwardRef<
  HTMLButtonElement,
  ContextChipTriggerProps
>(
  (
    { kind, labelKey, value, swatchClass, empty = false, className, ...rest },
    ref
  ) => {
    return (
      <button
        className={cn(
          "inline-flex max-w-full shrink-0 items-center gap-2 whitespace-nowrap rounded-pill py-[5px] pr-2.5 pl-2 text-[12px] leading-none focus-visible:outline-none",
          empty && "text-ink-3",
          !empty && "text-ink-2",
          className
        )}
        ref={ref}
        type="button"
        {...rest}
      >
        <span
          aria-hidden
          className={cn(
            "relative inline-block size-3.5 shrink-0 rounded-[4px]",
            empty && "border border-ink-4 border-dashed bg-transparent",
            !empty && !swatchClass && "bg-paper-2",
            !empty && swatchClass ? swatchClass : ""
          )}
        >
          {!empty && (
            <span
              aria-hidden
              className={cn(
                "absolute inset-[3px]",
                kind === "style"
                  ? "rounded-full border-[1.2px] border-ink/50 border-dashed"
                  : "rounded-[2px] border-[1.2px] border-ink/50 border-solid"
              )}
            />
          )}
        </span>
        <span className="font-mono text-[9.5px] text-ink-3 uppercase leading-none tracking-[0.08em]">
          {labelKey}
        </span>
        <span className="truncate text-[12px] leading-none">{value}</span>
      </button>
    );
  }
);
ContextChipTrigger.displayName = "ContextChipTrigger";

type ChipWrapperProps = {
  empty?: boolean;
  children: ReactNode;
  className?: string;
};

export function ChipWrapper({ empty, children, className }: ChipWrapperProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full shrink-0 items-stretch rounded-pill border border-rule bg-paper transition-colors duration-fast ease-canon",
        "hover:border-rule-strong hover:bg-paper-2",
        empty && "border-dashed",
        className
      )}
    >
      {children}
    </span>
  );
}

type ChipRemoveButtonProps = {
  onRemove: () => void;
  label?: string;
};

export function ChipRemoveButton({ onRemove, label }: ChipRemoveButtonProps) {
  return (
    <button
      aria-label={label}
      className={cn(
        "mr-1 inline-flex size-5 shrink-0 items-center justify-center self-center rounded-full text-ink-4",
        "hover:bg-ink hover:text-paper"
      )}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onRemove();
      }}
      type="button"
    >
      <X className="size-2" strokeWidth={2.4} />
    </button>
  );
}
