import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

export type KbdProps = ComponentPropsWithoutRef<"kbd">;

export function Kbd({ className, children, ...props }: KbdProps) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-rule border-b-2 bg-paper-2 px-1.5 font-mono text-[10px] text-ink-2 uppercase leading-none tracking-[0.04em]",
        className
      )}
      {...props}
    >
      {children}
    </kbd>
  );
}
