import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

export type ModelProvider =
  | "claude"
  | "gpt"
  | "gemini"
  | "llama"
  | "deepseek"
  | "grok";

const providerColor: Record<ModelProvider, string> = {
  claude: "bg-model-claude",
  gpt: "bg-model-gpt",
  gemini: "bg-model-gemini",
  llama: "bg-model-llama",
  deepseek: "bg-model-deepseek",
  grok: "bg-model-grok",
};

const sizeClass = {
  sm: "size-2",
  md: "size-2.5",
  lg: "size-3",
} as const;

export type ModelDotProps = Omit<ComponentPropsWithoutRef<"span">, "color"> & {
  provider: ModelProvider;
  size?: keyof typeof sizeClass;
};

export function ModelDot({
  provider,
  size = "md",
  className,
  ...props
}: ModelDotProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block shrink-0 rounded-full",
        providerColor[provider],
        sizeClass[size],
        className
      )}
      {...props}
    />
  );
}

const PROVIDER_ALIASES: Array<{ pattern: RegExp; provider: ModelProvider }> = [
  { pattern: /claude|opus|sonnet|haiku|anthropic/i, provider: "claude" },
  { pattern: /gpt|openai|codex|dalle|dall-e/i, provider: "gpt" },
  { pattern: /gemini|google/i, provider: "gemini" },
  { pattern: /llama|meta/i, provider: "llama" },
  { pattern: /deepseek/i, provider: "deepseek" },
  { pattern: /grok|xai/i, provider: "grok" },
];

export function inferModelProvider(modelId: string): ModelProvider {
  for (const { pattern, provider } of PROVIDER_ALIASES) {
    if (pattern.test(modelId)) {
      return provider;
    }
  }
  return "gpt";
}
