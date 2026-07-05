"use client";

import { IMAGE_SIZE_TO_ASPECT, type ImageGenOption } from "@/lib/ai/models";
import { cn } from "@/lib/utils";

/**
 * Pixel dimensions of the small rectangle that visualizes an aspect ratio
 * inside a tile. Values come from the approved design mockup.
 */
const RATIO_SHAPES: Record<string, { w: number; h: number }> = {
  "1:1": { w: 18, h: 18 },
  "16:9": { w: 26, h: 15 },
  "9:16": { w: 15, h: 26 },
  "3:2": { w: 24, h: 16 },
  "2:3": { w: 16, h: 24 },
  "4:3": { w: 23, h: 17 },
  "3:4": { w: 17, h: 23 },
  "5:4": { w: 21, h: 17 },
  "4:5": { w: 17, h: 21 },
  "21:9": { w: 28, h: 12 },
  "9:21": { w: 12, h: 28 },
};

const FALLBACK_SHAPE = { w: 18, h: 18 };
const AUTO_SHAPE = { w: 20, h: 20 };

/**
 * Short display token for an aspect option value: ratio strings pass through,
 * OpenAI size strings collapse to their ratio, "auto" gets the localized label.
 */
export const getAspectToken = (value: string, autoLabel: string): string => {
  if (value === "auto") {
    return autoLabel;
  }
  return IMAGE_SIZE_TO_ASPECT[value] ?? value;
};

type RatioTileProps = {
  value: string;
  token: string;
  selected: boolean;
  ariaLabel: string;
  onSelect: () => void;
};

export function RatioTile({
  value,
  token,
  selected,
  ariaLabel,
  onSelect,
}: RatioTileProps) {
  const isAuto = value === "auto";
  const ratioKey = IMAGE_SIZE_TO_ASPECT[value] ?? value;
  const shape = isAuto
    ? AUTO_SHAPE
    : (RATIO_SHAPES[ratioKey] ?? FALLBACK_SHAPE);

  return (
    <button
      aria-label={ariaLabel}
      aria-pressed={selected}
      className={cn(
        "flex min-w-0 flex-col items-center justify-end gap-1 rounded-md border border-transparent px-0.5 pt-1.5 pb-2 transition-colors duration-fast ease-canon",
        "hover:bg-paper-2",
        selected && "border-citrus bg-citrus-soft"
      )}
      onClick={onSelect}
      type="button"
    >
      <span
        className={cn(
          "font-mono text-[10px] text-ink-3",
          selected && "font-medium text-ink"
        )}
      >
        {token}
      </span>
      <span
        aria-hidden
        className={cn(
          "rounded-[3px] border-[1.5px] border-rule-strong transition-colors duration-fast ease-canon",
          isAuto && "border-dashed",
          selected && !isAuto && "border-ink bg-ink",
          selected && isAuto && "border-ink"
        )}
        style={{ width: shape.w, height: shape.h }}
      />
    </button>
  );
}

type SettingChipRowProps = {
  options: readonly ImageGenOption[];
  value: string | undefined;
  /** Single-option sections render as informational, non-interactive chips. */
  locked?: boolean;
  tokenFor: (option: ImageGenOption) => string;
  ariaFor: (option: ImageGenOption) => string;
  onSelect: (option: ImageGenOption) => void;
};

/** Row of selectable value chips (quality, duration, resolution, mode). */
export function SettingChipRow({
  options,
  value,
  locked = false,
  tokenFor,
  ariaFor,
  onSelect,
}: SettingChipRowProps) {
  return (
    <>
      {options.map((option) => (
        <button
          aria-label={ariaFor(option)}
          aria-pressed={value === option.value}
          className={cn(
            "min-w-10 rounded-md border border-rule px-2.5 py-1.5 font-mono text-[11px] text-ink-2 transition-colors duration-fast ease-canon",
            "hover:bg-paper-2",
            value === option.value &&
              !locked &&
              "border-ink bg-ink text-paper hover:bg-ink",
            locked && "opacity-45"
          )}
          disabled={locked}
          key={option.value}
          onClick={() => onSelect(option)}
          type="button"
        >
          {tokenFor(option)}
        </button>
      ))}
    </>
  );
}
