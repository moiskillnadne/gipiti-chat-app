"use client";

import { Check, Copy, MessageSquare, Star, X } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Prompt } from "@/lib/db/schema";
import { useTranslations } from "@/lib/i18n/translate";
import {
  getPromptCategory,
  getPromptModelMeta,
} from "@/lib/prompts/prompt-meta";
import { PromptPlaceholders } from "./prompt-placeholders";

const COPIED_RESET_MS = 1600;

type PromptDetailModalProps = {
  prompt: Prompt | null;
  isFavorite: boolean;
  onClose: () => void;
  onToggleFavorite: (id: string) => void;
  onUse: (prompt: Prompt) => void;
};

export function PromptDetailModal({
  prompt,
  isFavorite,
  onClose,
  onToggleFavorite,
  onUse,
}: PromptDetailModalProps) {
  const t = useTranslations("promptLibrary");
  const tModelList = useTranslations("modelList");
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {
      // Clipboard may be unavailable (insecure context) — fail silently.
    });
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_RESET_MS);
  };

  const category = prompt ? getPromptCategory(prompt.category) : undefined;
  const model = prompt ? getPromptModelMeta(prompt.modelId) : null;

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      open={prompt !== null}
    >
      {prompt && model ? (
        <DialogContent aria-describedby={undefined}>
          <div className="flex items-start gap-3 border-rule border-b px-[22px] pt-[22px] pb-4">
            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center gap-1.5 font-medium font-mono text-[10px] text-ink-3 uppercase tracking-[0.06em]">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: category?.color }}
                />
                {category ? t(category.labelKey) : prompt.category}
              </span>
              <DialogTitle className="mt-2.5 font-normal text-[21px] text-ink leading-[1.2] tracking-[-0.02em]">
                {prompt.title}
              </DialogTitle>
            </div>
            <DialogClose className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-3 transition-colors duration-fast ease-canon hover:bg-paper-2 hover:text-ink">
              <X className="size-[17px]" />
              <span className="sr-only">{t("close")}</span>
            </DialogClose>
          </div>

          <div className="flex flex-1 flex-col gap-[18px] overflow-y-auto px-[22px] py-5">
            <div className="flex items-center gap-3 rounded-md border border-rule bg-card-sunk px-[15px] py-[13px]">
              <span
                className="size-[11px] shrink-0 rounded-full"
                style={{ background: model.color }}
              />
              <div className="min-w-0 flex-1">
                <b className="font-medium text-[13.5px] text-ink">
                  {tModelList(model.name)}
                </b>
                {model.description ? (
                  <span className="mt-px block text-[11.5px] text-ink-3">
                    {tModelList(model.description)}
                  </span>
                ) : null}
              </div>
              <span className="shrink-0 rounded-xs bg-citrus-soft px-[7px] py-1 font-mono text-[9px] text-citrus-deep uppercase tracking-[0.07em]">
                {t("recommended")}
              </span>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between font-mono text-[10px] text-ink-3 uppercase tracking-[0.08em]">
                <span>{t("promptLabel")}</span>
                <button
                  className="inline-flex items-center gap-1.5 rounded-xs px-[7px] py-[3px] font-mono text-[10px] tracking-[0.04em] transition-colors duration-fast ease-canon hover:bg-paper-2 hover:text-ink"
                  onClick={() => handleCopy(prompt.body)}
                  type="button"
                >
                  {copied ? (
                    <Check className="size-3" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                  {copied ? t("copied") : t("copy")}
                </button>
              </div>
              <div className="whitespace-pre-wrap text-[14.5px] text-ink leading-[1.7]">
                <PromptPlaceholders text={prompt.body} />
              </div>
            </div>

            {prompt.tags.length > 0 ? (
              <div>
                <div className="mb-2 font-mono text-[10px] text-ink-3 uppercase tracking-[0.08em]">
                  {t("tagsLabel")}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {prompt.tags.map((tag) => (
                    <span
                      className="rounded-xs bg-paper-2 px-[7px] py-[3px] font-mono text-[10px] text-ink-3 uppercase tracking-[0.04em]"
                      key={tag}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2.5 border-rule border-t bg-card-sunk px-[22px] py-4">
            <button
              className={`inline-flex items-center gap-2 rounded-[9px] border px-[13px] py-[9px] font-medium text-[13px] transition-colors duration-fast ease-canon ${
                isFavorite
                  ? "border-citrus bg-citrus-soft text-citrus-deep"
                  : "border-rule-strong text-ink-2 hover:border-ink hover:text-ink"
              }`}
              onClick={() => onToggleFavorite(prompt.id)}
              type="button"
            >
              <Star
                className="size-[15px]"
                fill={isFavorite ? "currentColor" : "none"}
              />
              {isFavorite ? t("favorited") : t("favorite")}
            </button>
            <span className="flex-1" />
            <button
              className="inline-flex items-center gap-2 rounded-[9px] bg-ink px-5 py-3 font-medium text-[14px] text-paper transition-colors duration-fast ease-canon hover:bg-ink-2"
              onClick={() => onUse(prompt)}
              type="button"
            >
              <MessageSquare className="size-[15px]" />
              {t("useInNewChat")}
            </button>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
