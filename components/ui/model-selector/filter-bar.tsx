"use client";

import { useTranslations } from "@/lib/i18n/translate";
import {
  CAPABILITY_KEYS,
  type ModelCapabilityKey,
} from "@/lib/ai/model-capability";
import { cn } from "@/lib/utils";

import type { GroupBy } from "./use-model-selector";

type FilterBarProps = {
  group: GroupBy;
  onGroupChange: (group: GroupBy) => void;
  caps: ReadonlySet<ModelCapabilityKey>;
  onToggleCap: (cap: ModelCapabilityKey) => void;
  onClearCaps: () => void;
  totalCount: number;
  capCounts: Record<ModelCapabilityKey, number>;
};

export function FilterBar({
  group,
  onGroupChange,
  caps,
  onToggleCap,
  onClearCaps,
  totalCount,
  capCounts,
}: FilterBarProps) {
  const t = useTranslations("modelList");

  return (
    <div className="flex flex-col gap-2 border-rule border-b bg-card-sunk px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[9px] text-ink-4 uppercase tracking-[0.1em]">
          {t("group.label")}
        </span>
        <div
          className="inline-flex rounded-pill bg-paper-2 p-[3px]"
          role="tablist"
        >
          <SegButton
            isActive={group === "provider"}
            label={t("group.provider")}
            onClick={() => onGroupChange("provider")}
          />
          <SegButton
            isActive={group === "capability"}
            label={t("group.capability")}
            onClick={() => onGroupChange("capability")}
          />
        </div>
      </div>
      <div
        aria-label="Capability filters"
        className="flex flex-wrap gap-1.5"
        role="group"
      >
        <CapChip
          count={totalCount}
          isActive={caps.size === 0}
          label={t("capability.all")}
          onClick={onClearCaps}
        />
        {CAPABILITY_KEYS.map((cap) => (
          <CapChip
            count={capCounts[cap]}
            isActive={caps.has(cap)}
            key={cap}
            label={t(`capability.${cap}`)}
            onClick={() => onToggleCap(cap)}
          />
        ))}
      </div>
    </div>
  );
}

type SegButtonProps = {
  label: string;
  isActive: boolean;
  onClick: () => void;
};

function SegButton({ label, isActive, onClick }: SegButtonProps) {
  return (
    <button
      className={cn(
        "rounded-pill px-3 py-1 text-[11.5px] font-medium leading-none",
        "transition-all duration-fast ease-canon",
        isActive
          ? "bg-card text-ink shadow-sm"
          : "text-ink-3 hover:text-ink-2"
      )}
      onClick={onClick}
      role="tab"
      aria-selected={isActive}
      type="button"
    >
      {label}
    </button>
  );
}

type CapChipProps = {
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
};

function CapChip({ label, count, isActive, onClick }: CapChipProps) {
  return (
    <button
      aria-pressed={isActive}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1",
        "text-[11.5px] leading-none transition-all duration-fast ease-canon",
        isActive
          ? "border-ink bg-ink text-paper"
          : "border-rule bg-card text-ink-2 hover:border-rule-strong hover:text-ink"
      )}
      onClick={onClick}
      type="button"
    >
      <span>{label}</span>
      <span
        className={cn(
          "rounded-pill px-1.5 py-px font-mono text-[9px] leading-none",
          isActive ? "bg-white/15 text-paper/70" : "bg-paper-2 text-ink-4"
        )}
      >
        {count}
      </span>
    </button>
  );
}
