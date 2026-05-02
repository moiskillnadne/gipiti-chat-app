import { cva, type VariantProps } from "class-variance-authority";
import { Slot as SlotPrimitive } from "radix-ui";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill font-medium text-sm leading-none transition-[background-color,color,box-shadow,transform] duration-fast ease-canon focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-citrus-soft active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-ink text-paper hover:bg-ink-2",
        citrus: "bg-citrus text-ink hover:bg-citrus-deep hover:text-paper",
        secondary:
          "bg-transparent text-ink ring-1 ring-ink ring-inset hover:bg-ink hover:text-paper",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-rule bg-card text-ink hover:bg-paper-2 hover:text-ink",
        ghost: "bg-transparent text-ink-2 hover:bg-paper-2 hover:text-ink",
        link: "rounded-none text-ink underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-[18px] py-[10px]",
        sm: "h-9 px-[14px] py-[7px] text-[13px]",
        lg: "h-11 px-[22px] py-[14px] text-base",
        icon: "h-10 w-10 p-[10px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? SlotPrimitive.Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
