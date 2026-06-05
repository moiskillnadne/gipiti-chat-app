"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "@/lib/i18n/translate";

type PromptPagerProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

const navButton =
  "inline-flex items-center gap-1.5 rounded-pill border border-rule-strong bg-paper px-[13px] py-2 font-medium text-[13px] text-ink-2 transition-colors duration-fast ease-canon hover:enabled:border-ink hover:enabled:text-ink disabled:cursor-not-allowed disabled:opacity-40";

export function PromptPager({
  page,
  totalPages,
  onPageChange,
}: PromptPagerProps) {
  const t = useTranslations("promptLibrary");
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <div className="mt-7 flex items-center justify-center gap-3">
      <button
        className={navButton}
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
        type="button"
      >
        <ChevronLeft className="size-[15px]" />
        {t("pagerPrev")}
      </button>

      <div className="flex items-center gap-1">
        {pages.map((pageNumber) => (
          <button
            className={`size-[34px] rounded-[9px] font-medium text-[13px] tabular-nums transition-colors duration-fast ease-canon ${
              pageNumber === page
                ? "bg-ink text-paper"
                : "text-ink-2 hover:bg-paper-2 hover:text-ink"
            }`}
            key={pageNumber}
            onClick={() => onPageChange(pageNumber)}
            type="button"
          >
            {pageNumber}
          </button>
        ))}
      </div>

      <button
        className={navButton}
        disabled={page === totalPages}
        onClick={() => onPageChange(page + 1)}
        type="button"
      >
        {t("pagerNext")}
        <ChevronRight className="size-[15px]" />
      </button>
    </div>
  );
}
