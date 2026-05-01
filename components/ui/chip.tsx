"use client";

import { X } from "lucide-react";
import { type ComponentPropsWithoutRef, forwardRef } from "react";

import { cn } from "@/lib/utils";

export type ChipProps = ComponentPropsWithoutRef<"div"> & {
  leading?: React.ReactNode;
  onRemove?: () => void;
};

export const Chip = forwardRef<HTMLDivElement, ChipProps>(
  ({ className, children, leading, onRemove, ...props }, ref) => {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 rounded-pill bg-paper-2 px-3 py-[5px] font-medium text-[13px] text-ink-2",
          onRemove && "pr-1.5",
          className
        )}
        ref={ref}
        {...props}
      >
        {leading}
        <span className="leading-none">{children}</span>
        {onRemove ? (
          <button
            aria-label="Remove"
            className="inline-flex size-4 items-center justify-center rounded-full opacity-50 transition-[opacity,background-color,color] duration-fast ease-canon hover:bg-ink hover:text-paper hover:opacity-100"
            onClick={onRemove}
            type="button"
          >
            <X className="size-3" strokeWidth={2} />
          </button>
        ) : null}
      </div>
    );
  }
);
Chip.displayName = "Chip";
