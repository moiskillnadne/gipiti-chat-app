"use client";

import { Brain } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useModel } from "@/contexts/model-context";
import {
  getModelById,
  supportsThinkingConfig,
  type ThinkingSetting,
} from "@/lib/ai/models";
import { useTranslations } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

type ThinkLevel = "auto" | "quick" | "standard" | "extended";

const LEVEL_BARS: Record<ThinkLevel, number> = {
  auto: 0,
  quick: 1,
  standard: 2,
  extended: 3,
};

type ThinkRow = {
  level: ThinkLevel;
  label: string;
  desc: string;
  setting: ThinkingSetting;
};

/**
 * Map the 4-row design (Auto/Quick/Standard/Extended) onto the actual
 * effort/budget values for the current model. Models can have 2-4 distinct
 * effort values, so we collapse them into our 4 buckets.
 */
const buildRows = (
  modelId: string,
  labels: Record<ThinkLevel, string>,
  descs: Record<ThinkLevel, string>
): ThinkRow[] | null => {
  const model = getModelById(modelId);
  if (!model?.thinkingConfig) {
    return null;
  }

  const config = model.thinkingConfig;

  if (config.type === "effort") {
    const values = [...config.values];
    const rows: ThinkRow[] = [];
    const tryAdd = (level: ThinkLevel, value: string | undefined) => {
      if (!value) {
        return;
      }
      rows.push({
        level,
        label: labels[level],
        desc: descs[level],
        setting: { type: "effort", value },
      });
    };
    tryAdd(
      "auto",
      values.find((v) => v === "auto")
    );
    tryAdd(
      "quick",
      values.find((v) => v === "low") ?? values.find((v) => v === "none")
    );
    tryAdd(
      "standard",
      values.find((v) => v === "medium")
    );
    tryAdd(
      "extended",
      values.find((v) => v === "high")
    );
    return rows;
  }

  // Budget config: bucket presets across the four levels.
  const presets = [...config.presets];
  if (presets.length === 0) {
    return null;
  }
  const rows: ThinkRow[] = [];
  const order: ThinkLevel[] = ["auto", "quick", "standard", "extended"];
  presets.forEach((preset, index) => {
    const level = order[Math.min(index, order.length - 1)];
    rows.push({
      level,
      label: labels[level],
      desc: descs[level],
      setting: { type: "budget", value: preset.value },
    });
  });
  return rows;
};

const settingsEqual = (
  a: ThinkingSetting | undefined,
  b: ThinkingSetting
): boolean => {
  if (!a) {
    return false;
  }
  return a.type === b.type && a.value === b.value;
};

export function ThinkPopover() {
  const tInput = useTranslations("chat.input");
  const { currentModelId, currentThinkingSetting, setCurrentThinkingSetting } =
    useModel();
  const [open, setOpen] = useState(false);

  const rows = useMemo(
    () =>
      buildRows(
        currentModelId,
        {
          auto: tInput("thinkAuto"),
          quick: tInput("thinkQuick"),
          standard: tInput("thinkStandard"),
          extended: tInput("thinkExtended"),
        },
        {
          auto: tInput("thinkAutoDesc"),
          quick: tInput("thinkQuickDesc"),
          standard: tInput("thinkStandardDesc"),
          extended: tInput("thinkExtendedDesc"),
        }
      ),
    [currentModelId, tInput]
  );

  if (!supportsThinkingConfig(currentModelId) || !rows) {
    return null;
  }

  const activeRow = rows.find((row) =>
    settingsEqual(currentThinkingSetting, row.setting)
  );
  const activeBars = activeRow ? LEVEL_BARS[activeRow.level] : 0;
  const isCustomActive = Boolean(currentThinkingSetting && !activeRow);
  const isAnyActive = Boolean(activeRow) || isCustomActive;

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1.5 rounded-pill border border-transparent px-2.5 py-1.5 text-[12.5px] text-ink-2 leading-none transition-colors duration-fast ease-canon",
            "hover:bg-paper-2 hover:text-ink",
            isAnyActive && "border-citrus bg-citrus-soft text-ink",
            "data-[state=open]:bg-paper-2 data-[state=open]:text-ink"
          )}
          type="button"
        >
          <Brain className="size-3.5" strokeWidth={1.6} />
          <span>
            {tInput("think")}
            {activeRow ? ` · ${activeRow.label}` : ""}
          </span>
          {activeBars > 0 && (
            <span
              aria-hidden
              className="ml-0.5 inline-flex items-end gap-[1.5px]"
            >
              <span
                className={cn(
                  "h-[6px] w-[2px] rounded-[1px] bg-current opacity-40",
                  activeBars >= 1 && "opacity-100"
                )}
              />
              <span
                className={cn(
                  "h-[9px] w-[2px] rounded-[1px] bg-current opacity-40",
                  activeBars >= 2 && "opacity-100"
                )}
              />
              <span
                className={cn(
                  "h-[12px] w-[2px] rounded-[1px] bg-current opacity-40",
                  activeBars >= 3 && "opacity-100"
                )}
              />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[280px] overflow-hidden rounded-md border border-rule bg-card p-0 text-popover-foreground shadow-pop"
        side="top"
        sideOffset={8}
      >
        <div className="flex items-center gap-2 border-rule border-b px-3 py-2.5">
          <Brain className="size-3.5 text-citrus-deep" strokeWidth={1.6} />
          <span className="font-mono text-[10px] text-ink-3 uppercase tracking-[0.1em]">
            <b className="font-medium text-ink">{tInput("reasoningHeader")}</b>{" "}
            · {tInput("reasoningSubtitle")}
          </span>
        </div>
        <div className="p-1">
          {rows.map((row) => {
            const isSelected = settingsEqual(
              currentThinkingSetting,
              row.setting
            );
            const bars = LEVEL_BARS[row.level];
            return (
              <button
                className={cn(
                  "grid w-full grid-cols-[16px_1fr_auto] items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors duration-fast ease-canon",
                  "hover:bg-paper-2",
                  isSelected && "bg-paper-2"
                )}
                key={row.level}
                onClick={() => {
                  setCurrentThinkingSetting(row.setting);
                  setOpen(false);
                }}
                type="button"
              >
                <span
                  aria-hidden
                  className={cn(
                    "relative inline-block size-3.5 rounded-full border-[1.5px] border-rule-strong transition-colors",
                    isSelected && "border-ink"
                  )}
                >
                  {isSelected && (
                    <span className="absolute inset-[2.5px] rounded-full bg-ink" />
                  )}
                </span>
                <span className="flex min-w-0 flex-col gap-px">
                  <span className="flex items-center gap-1.5 font-medium text-[13px] text-ink">
                    {row.label}
                    {bars > 0 && (
                      <span
                        aria-hidden
                        className="inline-flex items-end gap-[2px]"
                      >
                        {[1, 2, 3].map((slot) => (
                          <span
                            className={cn(
                              "h-2 w-[3px] rounded-[1px] bg-ink-4",
                              slot <= bars && "bg-citrus-deep"
                            )}
                            key={slot}
                          />
                        ))}
                      </span>
                    )}
                  </span>
                  <span className="text-[11.5px] text-ink-3">{row.desc}</span>
                </span>
                <span />
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
