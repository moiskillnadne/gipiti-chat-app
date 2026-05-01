"use client";

import {
  type ButtonHTMLAttributes,
  createContext,
  type HTMLAttributes,
  useContext,
} from "react";

import { cn } from "@/lib/utils";

type SegmentedContextValue = {
  value: string;
  onValueChange: (value: string) => void;
};

const SegmentedContext = createContext<SegmentedContextValue | null>(null);

export type SegmentedControlProps = HTMLAttributes<HTMLDivElement> & {
  value: string;
  onValueChange: (value: string) => void;
};

export function SegmentedControl({
  value,
  onValueChange,
  className,
  children,
  ...props
}: SegmentedControlProps) {
  return (
    <SegmentedContext.Provider value={{ value, onValueChange }}>
      <div
        className={cn(
          "inline-flex gap-0.5 rounded-md bg-paper-2 p-[3px]",
          className
        )}
        role="tablist"
        {...props}
      >
        {children}
      </div>
    </SegmentedContext.Provider>
  );
}

export type SegmentedControlItemProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "value"
> & {
  value: string;
};

export function SegmentedControlItem({
  value,
  className,
  children,
  ...props
}: SegmentedControlItemProps) {
  const ctx = useContext(SegmentedContext);
  if (!ctx) {
    throw new Error(
      "SegmentedControlItem must be used inside SegmentedControl"
    );
  }
  const isActive = ctx.value === value;
  return (
    <button
      aria-selected={isActive}
      className={cn(
        "rounded-sm px-3.5 py-1.5 font-medium text-[13px] transition-[background-color,color,box-shadow] duration-fast ease-canon",
        isActive
          ? "bg-card text-ink shadow-sm"
          : "bg-transparent text-ink-2 hover:text-ink",
        className
      )}
      onClick={() => ctx.onValueChange(value)}
      role="tab"
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}
