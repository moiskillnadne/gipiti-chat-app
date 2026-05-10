"use client";

import { forwardRef } from "react";

import { useTranslations } from "@/lib/i18n/translate";

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
};

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput({ value, onChange }, ref) {
    const t = useTranslations("modelList.search");

    return (
      <div className="flex items-center gap-2 border-rule border-b px-3.5 py-2.5">
        <svg
          aria-hidden="true"
          className="size-3.5 shrink-0 text-ink-3"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.6}
          viewBox="0 0 24 24"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4.35-4.35" />
        </svg>
        <input
          autoComplete="off"
          className="flex-1 border-none bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-4"
          onChange={(event) => onChange(event.target.value)}
          placeholder={t("placeholder")}
          ref={ref}
          type="text"
          value={value}
        />
        <kbd className="hidden rounded-xs border border-rule bg-paper-2 px-1.5 py-0.5 font-mono text-[9px] text-ink-4 uppercase tracking-[0.04em] sm:inline-block">
          {t("esc")}
        </kbd>
      </div>
    );
  }
);
