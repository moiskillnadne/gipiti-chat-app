import { cn } from "@/lib/utils";
import { SparklesIcon } from "./icons";

type AssistantIconProps = {
  isLoading?: boolean;
  className?: string;
};

export const AssistantIcon = ({
  isLoading = false,
  className,
}: AssistantIconProps) => {
  return (
    <div
      className={cn(
        "-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border transition-shadow duration-300",
        {
          "animate-assistant-glow": isLoading,
        },
        className
      )}
    >
      <SparklesIcon size={14} />
    </div>
  );
};
