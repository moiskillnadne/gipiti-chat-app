"use client";

import { useTranslations } from "@/lib/i18n/translate";
import { useMemo, useState } from "react";

import { useModel } from "@/contexts/model-context";
import {
  type ChatModel,
  isImageGenerationModel,
  isVideoGenerationModel,
} from "@/lib/ai/models";
import { cn } from "@/lib/utils";

import {
  CheckCircleFillIcon,
  ChevronDownIcon,
  ImageIcon,
  PlayIcon,
} from "../icons";
import { inferModelProvider, ModelDot } from "./model-dot";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { RadioGroup, RadioGroupItem } from "./radio-group";

type ModelGroup = {
  provider: string;
  providerLabel: string;
  models: ChatModel[];
};

export function ModelSelector() {
  const [open, setOpen] = useState(false);
  const { currentModelId, setModelId, availableModels, getModelById } =
    useModel();
  const t = useTranslations("modelList");
  const tModels = useTranslations("chat.models");

  const currentModel = getModelById(currentModelId);

  // Group models by provider
  const groupedModels = useMemo<ModelGroup[]>(() => {
    const groups = new Map<string, ChatModel[]>();

    for (const model of availableModels) {
      const provider = model.provider || "other";
      if (!groups.has(provider)) {
        groups.set(provider, []);
      }
      groups.get(provider)?.push(model);
    }

    // Convert to array and sort providers in consistent order
    const providerOrder = [
      "openai",
      "google",
      "anthropic",
      "xai",
      "bfl",
      "recraft",
      "other",
    ];
    return Array.from(groups.entries())
      .map(([provider, models]) => ({
        provider,
        providerLabel: t(`providers.${provider}`) || provider.toUpperCase(),
        models,
      }))
      .sort(
        (a, b) =>
          providerOrder.indexOf(a.provider) - providerOrder.indexOf(b.provider)
      );
  }, [availableModels, t]);

  const handleModelChange = (modelId: string) => {
    setModelId(modelId);
    setOpen(false);
  };

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 rounded-pill bg-paper-2 px-2.5 py-1 font-normal text-[12px] text-ink-2 transition-colors duration-fast ease-canon hover:bg-paper-3"
          data-testid="model-selector-trigger"
          type="button"
        >
          <span className="size-1.5 shrink-0 rounded-full bg-success" />
          <span className="whitespace-nowrap">
            {currentModel ? t(currentModel.name) : "Select Model"}
          </span>
          <span
            className={cn(
              "text-ink-3 transition-transform duration-fast ease-canon",
              open && "rotate-180"
            )}
          >
            <ChevronDownIcon size={12} />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[320px] rounded-lg p-2 shadow-lg"
      >
        <div className="max-h-[400px] overflow-y-scroll">
          <RadioGroup
            className="gap-0"
            onValueChange={handleModelChange}
            value={currentModelId}
          >
            {groupedModels.map((group, groupIndex) => (
              <div key={group.provider}>
                {groupIndex > 0 && <div className="border-border border-t" />}
                <div className="px-3 py-2">
                  <div className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                    {group.providerLabel}
                  </div>
                </div>
                {group.models.map((model) => {
                  const isSelected = currentModelId === model.id;
                  return (
                    <label
                      className={cn(
                        "group relative flex min-h-[44px] cursor-pointer items-start gap-3 rounded-sm px-3 py-2.5 transition-colors duration-fast ease-canon hover:bg-paper-2",
                        isSelected &&
                          "before:-translate-y-1/2 bg-paper-2 before:absolute before:top-1/2 before:left-0 before:h-4 before:w-[3px] before:rounded-r-xs before:bg-citrus before:content-['']"
                      )}
                      data-testid={`model-option-${model.id}`}
                      htmlFor={`model-${model.id}`}
                      key={model.id}
                    >
                      <RadioGroupItem
                        className="sr-only"
                        id={`model-${model.id}`}
                        value={model.id}
                      />
                      <ModelDot
                        className="mt-1.5"
                        provider={inferModelProvider(model.id)}
                        size="sm"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 font-medium text-sm leading-tight">
                          {t(model.name)}
                          {isImageGenerationModel(model.id) && (
                            <span
                              className="text-muted-foreground"
                              title={tModels("imageGenerationModel")}
                            >
                              <ImageIcon size={14} />
                            </span>
                          )}
                          {isVideoGenerationModel(model.id) && (
                            <span
                              className="text-muted-foreground"
                              title={tModels("videoGenerationModel")}
                            >
                              <PlayIcon size={14} />
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-muted-foreground text-xs leading-snug">
                          {t(model.description)}
                        </div>
                      </div>
                      {isSelected && (
                        <span className="mt-0.5 flex-shrink-0 text-primary">
                          <CheckCircleFillIcon size={18} />
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            ))}
          </RadioGroup>
        </div>
      </PopoverContent>
    </Popover>
  );
}
