"use client";

import { useLayoutEffect, useRef } from "react";
import type { ChatModel } from "@/lib/ai/models";
import { useTranslations } from "@/lib/i18n/translate";

import { ModelDot, type ModelProvider } from "../model-dot";
import { centeredScrollTop } from "./centered-scroll-top";
import { ModelRow } from "./model-row";
import type { ModelGroup } from "./use-model-selector";

type ModelListProps = {
  groups: ModelGroup[];
  flatRows: ChatModel[];
  selectedId: string;
  query: string;
  onSelect: (id: string) => void;
};

export function ModelList({
  groups,
  flatRows,
  selectedId,
  query,
  onSelect,
}: ModelListProps) {
  const t = useTranslations("modelList");
  const tEmpty = useTranslations("modelList.empty");
  const listRef = useRef<HTMLDivElement>(null);

  // The list mounts when the selector opens: bring the current model into view once.
  useLayoutEffect(() => {
    const list = listRef.current;
    const selectedRow = list?.querySelector<HTMLElement>(
      '[aria-selected="true"]'
    );
    if (!list || !selectedRow) {
      return;
    }
    const listRect = list.getBoundingClientRect();
    const rowRect = selectedRow.getBoundingClientRect();
    // The popover opens with a zoom-in transform; undo it to get layout pixels.
    const scale =
      list.offsetHeight > 0 ? listRect.height / list.offsetHeight : 1;
    list.scrollTop = centeredScrollTop({
      rowOffsetTop: (rowRect.top - listRect.top) / scale + list.scrollTop,
      rowHeight: selectedRow.offsetHeight,
      listHeight: list.clientHeight,
      listScrollHeight: list.scrollHeight,
    });
  }, []);

  if (flatRows.length === 0) {
    return (
      <div className="px-5 py-9 text-center text-[13px] text-ink-3">
        {tEmpty("title")}
        <div className="mt-1.5 font-mono text-[10px] text-ink-3 uppercase tracking-[0.08em]">
          {tEmpty("hint")}
        </div>
      </div>
    );
  }

  return (
    <div
      className="model-selector-list max-h-[min(420px,55svh)] overflow-y-auto overscroll-contain py-1"
      ref={listRef}
    >
      {groups.map((group) => (
        <div
          className="border-rule border-dashed pt-2 first:border-t-0 [&+&]:mt-1 [&+&]:border-t"
          key={group.key}
        >
          <div className="flex items-center justify-between px-3 pt-1 pb-1.5">
            <span className="flex items-center gap-2 font-mono text-[9.5px] text-ink-3 uppercase tracking-[0.1em]">
              {group.kind === "provider" ? (
                <ModelDot
                  provider={group.providerKey as ModelProvider}
                  size="sm"
                />
              ) : null}
              {group.label}
            </span>
            <span className="font-mono text-[9px] text-ink-3">
              {group.models.length}
            </span>
          </div>
          <div className="flex flex-col">
            {group.models.map((model) => (
              <ModelRow
                isSelected={model.id === selectedId}
                key={model.id}
                model={model}
                onSelect={() => onSelect(model.id)}
                query={query}
                t={t}
                tSpeed={t}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
