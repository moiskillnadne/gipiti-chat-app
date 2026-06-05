"use client";

import { Star } from "lucide-react";
import type { Prompt } from "@/lib/db/schema";
import { useTranslations } from "@/lib/i18n/translate";
import {
  getPromptCategory,
  getPromptModelMeta,
} from "@/lib/prompts/prompt-meta";

const BRACKETS = /[[\]]/g;

type PromptCardProps = {
  prompt: Prompt;
  isFavorite: boolean;
  onOpen: (id: string) => void;
  onToggleFavorite: (id: string) => void;
};

export function PromptCard({
  prompt,
  isFavorite,
  onOpen,
  onToggleFavorite,
}: PromptCardProps) {
  const t = useTranslations("promptLibrary");
  const tModelList = useTranslations("modelList");
  const category = getPromptCategory(prompt.category);
  const model = getPromptModelMeta(prompt.modelId);
  const preview = prompt.body.replace(BRACKETS, "");

  return (
    // biome-ignore lint/a11y/useSemanticElements: card hosts a nested favorite button, so it cannot itself be a <button>
    <div
      className="group hover:-translate-y-0.5 relative flex cursor-pointer flex-col gap-3 rounded-lg border border-rule bg-card p-[18px] text-left transition-[border-color,transform,box-shadow] duration-fast ease-canon hover:border-rule-strong hover:shadow-md"
      onClick={() => onOpen(prompt.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(prompt.id);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 font-medium font-mono text-[10px] text-ink-3 uppercase tracking-[0.06em]">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ background: category?.color }}
          />
          {category ? t(category.labelKey) : prompt.category}
        </span>
        <button
          aria-pressed={isFavorite}
          className={`ml-auto inline-flex size-7 shrink-0 items-center justify-center rounded-sm transition-colors duration-fast ease-canon hover:bg-paper-2 ${
            isFavorite
              ? "text-citrus-deep"
              : "text-ink-4 hover:text-citrus-deep"
          }`}
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite(prompt.id);
          }}
          title={t("favorite")}
          type="button"
        >
          <Star
            className="size-4"
            fill={isFavorite ? "currentColor" : "none"}
          />
        </button>
      </div>

      <div className="font-medium text-[16px] text-ink leading-[1.25] tracking-[-0.01em]">
        {prompt.title}
      </div>

      <div className="line-clamp-3 flex-1 text-[13px] text-ink-3 leading-[1.55]">
        {preview}
      </div>

      <div className="flex items-center gap-2 border-rule border-t border-dashed pt-3">
        <span className="inline-flex min-w-0 items-center gap-2 text-[12px] text-ink-2">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ background: model.color }}
          />
          <span className="truncate font-medium">{tModelList(model.name)}</span>
        </span>
      </div>
    </div>
  );
}
