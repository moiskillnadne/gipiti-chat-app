"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { useModel } from "@/contexts/model-context";
import type { Prompt } from "@/lib/db/schema";
import { useTranslations } from "@/lib/i18n/translate";
import {
  getPromptModelMeta,
  PROMPT_CATEGORIES,
} from "@/lib/prompts/prompt-meta";
import type { PromptsResponse } from "@/lib/types";
import { fetcher } from "@/lib/utils";
import { PromptCard } from "./prompt-card";
import { PromptDetailModal } from "./prompt-detail-modal";
import { type PromptFilter, PromptFilterTabs } from "./prompt-filter-tabs";
import { PromptPager } from "./prompt-pager";

const PAGE_SIZE = 30;
const SCROLL_OFFSET = 120;

export function PromptLibrary() {
  const t = useTranslations("promptLibrary");
  const router = useRouter();
  const { availableModels, setModelId } = useModel();
  const { data, isLoading } = useSWR<PromptsResponse>("/api/prompts", fetcher);

  const prompts = useMemo(() => data?.prompts ?? [], [data]);

  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<PromptFilter>("all");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (data?.favoriteIds) {
      setFavoriteIds(new Set(data.favoriteIds));
    }
  }, [data?.favoriteIds]);

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

  const counts = useMemo(() => {
    const next: Record<string, number> = {
      all: prompts.length,
      fav: prompts.filter((prompt) => favoriteIds.has(prompt.id)).length,
    };
    for (const category of PROMPT_CATEGORIES) {
      next[category.id] = prompts.filter(
        (prompt) => prompt.category === category.id
      ).length;
    }
    return next;
  }, [prompts, favoriteIds]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return prompts.filter((prompt) => {
      if (activeFilter === "fav" && !favoriteIds.has(prompt.id)) {
        return false;
      }
      if (
        activeFilter !== "fav" &&
        activeFilter !== "all" &&
        prompt.category !== activeFilter
      ) {
        return false;
      }
      if (normalizedQuery) {
        const modelName = getPromptModelMeta(prompt.modelId).name;
        const haystack =
          `${prompt.title} ${prompt.body} ${prompt.tags.join(" ")} ${modelName}`.toLowerCase();
        if (!haystack.includes(normalizedQuery)) {
          return false;
        }
      }
      return true;
    });
  }, [prompts, activeFilter, query, favoriteIds]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const openPrompt = prompts.find((prompt) => prompt.id === openId) ?? null;

  const selectFilter = (filter: PromptFilter) => {
    setActiveFilter(filter);
    setPage(1);
  };

  const updateQuery = (value: string) => {
    setQuery(value);
    setPage(1);
  };

  const goToPage = (next: number) => {
    setPage(next);
    const grid = document.querySelector("[data-prompt-grid]");
    if (grid) {
      const top = grid.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: top - SCROLL_OFFSET, behavior: "smooth" });
    }
  };

  const toggleFavorite = async (id: string) => {
    const willFavorite = !favoriteIds.has(id);
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (willFavorite) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });

    try {
      const response = willFavorite
        ? await fetch("/api/prompts/favorite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ promptId: id }),
          })
        : await fetch(`/api/prompts/favorite?promptId=${id}`, {
            method: "DELETE",
          });
      if (!response.ok) {
        throw new Error("Request failed");
      }
    } catch {
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (willFavorite) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
      toast.error(t("favoriteError"));
    }
  };

  const handleUse = (prompt: Prompt) => {
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
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-4"
          onChange={(event) => updateQuery(event.target.value)}
          placeholder={t("searchPlaceholder")}
          ref={searchRef}
          value={query}
        />
        {query ? (
          <button
            className="inline-flex size-6 items-center justify-center rounded-full text-ink-4 transition-colors duration-fast ease-canon hover:bg-paper-2 hover:text-ink"
            onClick={() => updateQuery("")}
            type="button"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-[13px] text-ink-3">
          {t("loading")}
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
