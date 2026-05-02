import { type ComponentProps, forwardRef } from "react";
import { cn } from "@/lib/utils";

const Textarea = forwardRef<HTMLTextAreaElement, ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-rule bg-card px-3.5 py-2.5 text-ink text-sm",
          "transition-[color,border-color,box-shadow] duration-fast ease-canon",
          "placeholder:text-ink-3",
          "focus-visible:border-ink focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-citrus-soft",
          "aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/30",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
