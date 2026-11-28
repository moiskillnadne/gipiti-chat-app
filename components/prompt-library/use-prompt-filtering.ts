"use client";

import { useReducedMotion } from "framer-motion";
import { useMemo, useState } from "react";
import type { PromptDto } from "@/client/shared/api/types";
import { resolveScrollBehavior } from "@/lib/dom/scroll-behavior";
import {
  getPromptModelMeta,
  PROMPT_CATEGORIES,
} from "@/lib/prompts/prompt-meta";
import type { PromptFilter } from "./prompt-filter-tabs";

const PAGE_SIZE = 30;
const SCROLL_OFFSET = 120;

type PromptFiltering = {
  query: string;
  activeFilter: PromptFilter;
  counts: Record<string, number>;
  filtered: PromptDto[];
  paged: PromptDto[];
  safePage: number;
  totalPages: number;
  updateQuery: (value: string) => void;
  selectFilter: (filter: PromptFilter) => void;
  goToPage: (next: number) => void;
};

/** Client-side search, category/favourite filter and paging of the catalogue. */
export const usePromptFiltering = (
  prompts: PromptDto[],
  favoriteIds: Set<string>
): PromptFiltering => {
  const shouldReduceMotion = useReducedMotion();
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<PromptFilter>("all");
  const [page, setPage] = useState(1);

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
      window.scrollTo({
        top: top - SCROLL_OFFSET,
        behavior: resolveScrollBehavior("smooth", shouldReduceMotion),
      });
    }
  };

  return {
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
  };
};
