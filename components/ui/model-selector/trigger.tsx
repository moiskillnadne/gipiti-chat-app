"use client";

import { forwardRef } from "react";

import { useTranslations } from "@/lib/i18n/translate";
import { getModelSpeedLevel, SPEED_LABEL_KEY } from "@/lib/ai/model-speed";
import type { ChatModel } from "@/lib/ai/models";
import { cn } from "@/lib/utils";

import { ChevronDownIcon } from "../../icons";
import { inferModelProvider, ModelDot } from "../model-dot";

type TriggerProps = {
  model: ChatModel | undefined;
  isOpen: boolean;
  onClick: () => void;
};

export const ModelSelectorTrigger = forwardRef<HTMLButtonElement, TriggerProps>(
  function ModelSelectorTrigger({ model, isOpen, onClick }, ref) {
    const t = useTranslations("modelList");
    const tSpeed = useTranslations("modelList");

    const speedLevel = model ? getModelSpeedLevel(model.id) : 3;
    const levelLabel = tSpeed(SPEED_LABEL_KEY[speedLevel]);
    const name = model ? t(model.name) : t("trigger.open");

    return (
      <button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={cn(
          "inline-flex max-w-full items-center gap-2 rounded-pill border px-2.5 py-1.5",
          "whitespace-nowrap text-[12.5px] text-ink leading-none",
          "transition-all duration-fast ease-canon",
          isOpen
            ? "border-rule-strong bg-card shadow-sm"
            : "border-transparent bg-paper-2 hover:bg-paper-3"
        )}
        data-testid="model-selector-trigger"
        onClick={onClick}
        ref={ref}
        type="button"
      >
        {model ? (
          <ModelDot provider={inferModelProvider(model.id)} size="sm" />
        ) : (
          <span className="size-2 rounded-full bg-ink-4" />
        )}
        <span className="min-w-0 truncate font-medium">{name}</span>
        <span className="hidden font-light text-ink-4 sm:inline">·</span>
        <span className="hidden font-mono text-[9.5px] text-ink-3 uppercase tracking-[0.06em] sm:inline">
          {levelLabel}
        </span>
        <span
          className={cn(
            "inline-flex shrink-0 text-ink-3 transition-transform duration-base ease-canon",
            isOpen && "rotate-180"
          )}
        >
          <ChevronDownIcon size={11} />
        </span>
      </button>
    );
  }
);
