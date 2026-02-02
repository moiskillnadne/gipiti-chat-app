"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { chatModels, type ModelProvider } from "@/lib/ai/models";

const providerStyles: Record<ModelProvider | "unknown", string> = {
  openai: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  google: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  anthropic: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  xai: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  unknown: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

interface ModelBadgeProps {
  modelId: string;
}

export function ModelBadge({ modelId }: ModelBadgeProps) {
  const t = useTranslations("modelList");
  const model = chatModels.find((m) => m.id === modelId);

  if (!model) {
    return (
      <Badge className={providerStyles.unknown} variant="secondary">
        {modelId}
      </Badge>
    );
  }

  const providerStyle = providerStyles[model.provider ?? "unknown"];
  const displayName = t(model.name);

  return (
    <Badge className={`${providerStyle} font-normal`} variant="secondary">
      {displayName}
    </Badge>
  );
}
