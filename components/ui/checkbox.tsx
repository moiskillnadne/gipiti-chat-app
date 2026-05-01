"use client";

import { Check } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import {
  type ComponentPropsWithoutRef,
  type ElementRef,
  forwardRef,
} from "react";

import { cn } from "@/lib/utils";

const Checkbox = forwardRef<
  ElementRef<typeof CheckboxPrimitive.Root>,
  ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    className={cn(
      "peer h-[18px] w-[18px] shrink-0 rounded-xs border-[1.5px] border-rule-strong bg-card transition-[background-color,border-color] duration-fast ease-canon",
      "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-citrus-soft",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:border-ink data-[state=checked]:bg-ink data-[state=checked]:text-citrus",
      className
    )}
    ref={ref}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      <Check className="h-3.5 w-3.5" strokeWidth={3} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
