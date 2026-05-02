import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-xs border border-transparent px-2 py-[3px] font-medium font-mono text-[10px] uppercase leading-none tracking-[0.08em] transition-colors duration-fast ease-canon focus:outline-none focus:ring-3 focus:ring-citrus-soft",
  {
    variants: {
      variant: {
        default: "bg-paper-2 text-ink-2",
        citrus: "bg-citrus text-ink",
        ink: "bg-ink text-paper",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        success: "bg-citrus-soft/60 text-success",
        info: "bg-info/10 text-info",
        destructive: "bg-destructive/10 text-destructive",
        outline: "bg-transparent text-ink-2 ring-1 ring-rule-strong ring-inset",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export type BadgeProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof badgeVariants>;

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
