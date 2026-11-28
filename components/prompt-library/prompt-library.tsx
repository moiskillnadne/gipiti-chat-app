"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getApiErrorMessageKey } from "@/client/shared/api/errors";
import type { PromptDto } from "@/client/shared/api/types";
import { useModel } from "@/contexts/model-context";
import { useTranslations } from "@/lib/i18n/translate";
import { PromptCard } from "./prompt-card";
import { PromptDetailModal } from "./prompt-detail-modal";
import { PromptFilterTabs } from "./prompt-filter-tabs";
import { PromptPager } from "./prompt-pager";
import { usePromptFiltering } from "./use-prompt-filtering";
import { usePromptLibraryData } from "./use-prompt-library-data";

export function PromptLibrary() {
  const t = useTranslations("promptLibrary");
  const router = useRouter();
  const { availableModels, setModelId } = useModel();
  const tErrors = useTranslations("errors");
  const { prompts, favoriteIds, isLoading, loadError, toggleFavorite } =
    usePromptLibraryData();
  const {
    query,
    activeFilter,
    counts,
    filtered,
    paged,
    safePage,
    totalPages,
    updateQuery,
    selectFilter,
    goToPage,
  } = usePromptFiltering(prompts, favoriteIds);
  const [openId, setOpenId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openPrompt = prompts.find((prompt) => prompt.id === openId) ?? null;

  const handleUse = (prompt: PromptDto) => {
    if (availableModels.some((model) => model.id === prompt.modelId)) {
      setModelId(prompt.modelId);
    }
    navigator.clipboard?.writeText(prompt.body).catch(() => {
      // Clipboard may be unavailable — the prompt still prefills the composer.
    });
    setOpenId(null);
    toast.success(t("useToast"));
    router.push(`/chat?prefill=${encodeURIComponent(prompt.body)}`);
  };

  const loadErrorKey = loadError ? getApiErrorMessageKey(loadError) : null;

  const isFavFilter = activeFilter === "fav";
  const resultSuffix = `${isFavFilter ? ` ${t("inFavorites")}` : ""}${
    query ? ` ${t("byQuery")}` : ""
  }`;

  return (
    <div className="mx-auto w-full max-w-[1340px] px-7 pt-8 pb-24 max-md:px-[18px]">
      <h1 className="mb-[22px] font-light text-[34px] text-ink leading-[1.02] tracking-[-0.03em]">
        {t("title")} <em className="text-ink-2 italic">{t("titleEm")}</em>
      </h1>

      <div className="mb-[18px] flex items-center gap-3 rounded-lg border border-rule bg-card px-[18px] py-[13px] shadow-sm transition-all duration-fast ease-canon focus-within:border-ink focus-within:ring-[3px] focus-within:ring-citrus-soft">
        <Search className="size-[18px] shrink-0 text-ink-3" />
        <input
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3"
          onChange={(event) => updateQuery(event.target.value)}
          placeholder={t("searchPlaceholder")}
          ref={searchRef}
          value={query}
        />
        {query ? (
          <button
            aria-label={t("clearSearch")}
            className="inline-flex size-6 items-center justify-center rounded-full text-ink-3 transition-colors duration-fast ease-canon hover:bg-paper-2 hover:text-ink"
            onClick={() => {
              updateQuery("");
              // The button unmounts once the query is empty; keep focus in the search
              searchRef.current?.focus();
            }}
            type="button"
          >
            <X aria-hidden className="size-3.5" />
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-[13px] text-ink-3">
          {t("loading")}
        </div>
      ) : loadErrorKey ? (
        <div
          className="flex items-center justify-center py-24 text-[13px] text-ink-3"
          role="alert"
        >
          {tErrors(loadErrorKey)}
        </div>
      ) : (
        <>
          <PromptFilterTabs
            activeFilter={activeFilter}
            counts={counts}
            onSelect={selectFilter}
          />

          <div className="flex items-center justify-between px-0.5 pt-[18px] pb-3.5">
            <span className="font-mono text-[11px] text-ink-3 uppercase tracking-[0.08em]">
              <b className="font-semibold text-ink-2">{filtered.length}</b>{" "}
              {t("promptsNoun", { count: filtered.length })}
              {resultSuffix}
            </span>
            {totalPages > 1 ? (
              <span className="font-mono text-[11px] text-ink-3 uppercase tracking-[0.08em]">
                {t("pageIndicator", { current: safePage, total: totalPages })}
              </span>
            ) : null}
          </div>

          <div
            className="grid grid-cols-1 items-start gap-3.5 sm:grid-cols-2 lg:grid-cols-3"
            data-prompt-grid
          >
            {filtered.length === 0 ? (
              <div className="col-span-full rounded-lg border border-rule-strong border-dashed px-6 py-[60px] text-center text-ink-3">
                <Search className="mx-auto mb-3 size-7 text-ink-4" />
                <h3 className="mb-1.5 font-medium text-[16px] text-ink">
                  {t("emptyTitle")}
                </h3>
                <p className="mx-auto max-w-[360px] text-[13px]">
                  {isFavFilter ? t("emptyFavDesc") : t("emptyDesc")}
                </p>
              </div>
            ) : (
              paged.map((prompt) => (
                <PromptCard
                  isFavorite={favoriteIds.has(prompt.id)}
                  key={prompt.id}
                  onOpen={setOpenId}
                  onToggleFavorite={toggleFavorite}
                  prompt={prompt}
                />
              ))
            )}
          </div>

          {totalPages > 1 ? (
            <PromptPager
              onPageChange={goToPage}
              page={safePage}
              totalPages={totalPages}
            />
          ) : null}
        </>
      )}

      <PromptDetailModal
        isFavorite={openPrompt ? favoriteIds.has(openPrompt.id) : false}
        onClose={() => setOpenId(null)}
        onToggleFavorite={toggleFavorite}
        onUse={handleUse}
        prompt={openPrompt}
      />
    </div>
  );
}
