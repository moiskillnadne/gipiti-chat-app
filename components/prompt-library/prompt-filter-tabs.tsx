"use client";

import { Star } from "lucide-react";
import { useTranslations } from "@/lib/i18n/translate";
import { PROMPT_CATEGORIES } from "@/lib/prompts/prompt-meta";

export type PromptFilter = "fav" | "all" | string;

type PromptFilterTabsProps = {
  activeFilter: PromptFilter;
  counts: Record<string, number>;
  onSelect: (filter: PromptFilter) => void;
};

const baseTab =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill border px-[13px] py-[7px] font-medium text-[13px] transition-colors duration-fast ease-canon";

export function PromptFilterTabs({
  activeFilter,
  counts,
  onSelect,
}: PromptFilterTabsProps) {
  const t = useTranslations("promptLibrary");
  const isFav = activeFilter === "fav";
  const isAll = activeFilter === "all";

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-rule border-b pb-[18px]">
      <button
        className={`${baseTab} ${
          isFav
            ? "border-citrus-deep bg-citrus-deep text-white"
            : "border-rule bg-paper text-ink-2 hover:border-rule-strong hover:text-ink"
        }`}
        onClick={() => onSelect("fav")}
        type="button"
      >
        <Star className="size-3.5" fill={isFav ? "currentColor" : "none"} />
        {t("tabFavorites")}
        <span
          className={`font-mono text-[10px] ${isFav ? "text-white/60" : "text-ink-4"}`}
        >
          {counts.fav ?? 0}
        </span>
      </button>

      <span className="mx-[3px] h-5 w-px bg-rule" />

      <button
        className={`${baseTab} ${
          isAll
            ? "border-ink bg-ink text-paper"
            : "border-rule bg-paper text-ink-2 hover:border-rule-strong hover:text-ink"
        }`}
        onClick={() => onSelect("all")}
        type="button"
      >
        {t("tabAll")}
        <span
          className={`font-mono text-[10px] ${isAll ? "text-white/50" : "text-ink-4"}`}
        >
          {counts.all ?? 0}
        </span>
      </button>

      {PROMPT_CATEGORIES.map((category) => {
        const isActive = activeFilter === category.id;
        return (
          <button
            className={`${baseTab} ${
              isActive
                ? "border-ink bg-ink text-paper"
                : "border-rule bg-paper text-ink-2 hover:border-rule-strong hover:text-ink"
            }`}
            key={category.id}
            onClick={() => onSelect(category.id)}
            type="button"
          >
            <span
              className="size-[7px] shrink-0 rounded-full"
              style={{ background: category.color }}
            />
            {t(category.labelKey)}
            <span
              className={`font-mono text-[10px] ${
                isActive ? "text-white/50" : "text-ink-4"
              }`}
            >
              {counts[category.id] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}
