import { type ComponentProps, forwardRef } from "react";

import { cn } from "@/lib/utils";

const Input = forwardRef<HTMLInputElement, ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        className={cn(
          "flex h-10 w-full rounded-md border border-rule bg-card px-3.5 py-2.5 text-ink text-sm",
          "transition-[color,border-color,box-shadow] duration-fast ease-canon",
          "placeholder:text-ink-3",
          "file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-sm",
          "focus-visible:border-ink focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-citrus-soft",
          "aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/30",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        type={type}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
