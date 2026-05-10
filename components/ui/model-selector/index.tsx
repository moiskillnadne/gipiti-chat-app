"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useModel } from "@/contexts/model-context";
import { useTranslations } from "@/lib/i18n/translate";

import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import { FilterBar } from "./filter-bar";
import { Footer } from "./footer";
import { ModelList } from "./model-list";
import { SearchInput } from "./search-input";
import { ModelSelectorTrigger } from "./trigger";
import { useModelSelector } from "./use-model-selector";

export function ModelSelector() {
  const [open, setOpen] = useState(false);
  const { currentModelId, setModelId, availableModels, getModelById } =
    useModel();
  const t = useTranslations("modelList");
  const searchRef = useRef<HTMLInputElement>(null);

  const currentModel = getModelById(currentModelId);

  const {
    query,
    setQuery,
    group,
    setGroup,
    caps,
    toggleCap,
    clearCaps,
    capCounts,
    groups,
    flatRows,
    resetState,
  } = useModelSelector({ availableModels, t });

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next) {
        resetState();
      }
    },
    [resetState]
  );

  const handleSelect = useCallback(
    (id: string) => {
      setModelId(id);
      setOpen(false);
      resetState();
    },
    [resetState, setModelId]
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    const isDesktop = window.matchMedia("(min-width: 768px)").matches;
    if (!isDesktop) {
      return;
    }
    const focusTimer = window.setTimeout(() => {
      searchRef.current?.focus();
    }, 16);
    return () => window.clearTimeout(focusTimer);
  }, [open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isToggle =
        (event.key === "k" || event.key === "K") &&
        (event.metaKey || event.ctrlKey);
      if (!isToggle) {
        return;
      }
      event.preventDefault();
      setOpen((prev) => !prev);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <Popover onOpenChange={handleOpenChange} open={open}>
      <PopoverTrigger asChild>
        <ModelSelectorTrigger
          isOpen={open}
          model={currentModel}
          onClick={() => setOpen((prev) => !prev)}
        />
      </PopoverTrigger>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              aria-hidden="true"
              className="fade-in fixed inset-0 z-40 animate-in bg-ink/35 backdrop-blur-[2px] duration-base ease-canon md:hidden"
            />,
            document.body
          )
        : null}
      <PopoverContent
        align="start"
        className="w-[min(420px,calc(100vw-1rem))] overflow-hidden rounded-lg border-rule bg-card p-0 shadow-pop"
        collisionPadding={8}
        onOpenAutoFocus={(event) => {
          if (typeof window === "undefined") {
            return;
          }
          const isDesktop = window.matchMedia("(min-width: 768px)").matches;
          if (!isDesktop) {
            event.preventDefault();
          }
        }}
        sideOffset={8}
      >
        <SearchInput onChange={setQuery} ref={searchRef} value={query} />
        <FilterBar
          capCounts={capCounts}
          caps={caps}
          group={group}
          onClearCaps={clearCaps}
          onGroupChange={setGroup}
          onToggleCap={toggleCap}
          totalCount={availableModels.length}
        />
        <ModelList
          flatRows={flatRows}
          groups={groups}
          onSelect={handleSelect}
          query={query}
          selectedId={currentModelId}
        />
        <Footer count={flatRows.length} />
      </PopoverContent>
    </Popover>
  );
}
