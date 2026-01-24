import type { FC } from "react";
import { getModelById, type ModelProvider } from "@/lib/ai/models";
import { cn } from "@/lib/utils";
import {
  LogoAnthropic,
  LogoGoogle,
  LogoOpenAI,
  LogoXai,
  SparklesIcon,
} from "./icons";

type AssistantIconProps = {
  isLoading?: boolean;
  className?: string;
  modelId?: string;
};

type IconComponentProps = { size?: number };

const providerIconMap: Record<ModelProvider, FC<IconComponentProps>> = {
  openai: LogoOpenAI,
  google: LogoGoogle,
  anthropic: LogoAnthropic,
  xai: LogoXai,
};

export const AssistantIcon = ({
  isLoading = false,
  className,
  modelId,
}: AssistantIconProps) => {
  const model = modelId ? getModelById(modelId) : undefined;
  const provider = model?.provider;

  const IconComponent = provider ? providerIconMap[provider] : SparklesIcon;

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
      <IconComponent size={14} />
    </div>
  );
};
