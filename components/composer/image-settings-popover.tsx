"use client";

import { ImageIcon, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useModel } from "@/contexts/model-context";
import {
  getDefaultImageGenSetting,
  getModelById,
  type ImageGenOption,
  supportsImageGenConfig,
} from "@/lib/ai/models";
import { useTranslations } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import {
  getAspectToken,
  RatioTile,
  SettingChipRow,
} from "./media-settings-controls";

const RAW_QUALITY_PATTERN = /^\dK$/;

/**
 * Model-dependent image generation settings (aspect ratio, quality) in the
 * composer toolbar. Sections are built from the model's imageGenConfig — a
 * model without a quality config gets no quality section, and models without
 * any imageGenConfig render no pill at all.
 */
export function ImageSettingsPopover() {
  const tInput = useTranslations("chat.input");
  const tImg = useTranslations("imageGenSetting");
  const tModels = useTranslations("modelList");
  const { currentModelId, currentImageGenSetting, setCurrentImageGenSetting } =
    useModel();
  const [open, setOpen] = useState(false);

  const model = getModelById(currentModelId);
  if (!(supportsImageGenConfig(currentModelId) && model?.imageGenConfig)) {
    return null;
  }

  const { aspectRatio, quality } = model.imageGenConfig;
  const defaults = getDefaultImageGenSetting(currentModelId);
  const setting = currentImageGenSetting ?? defaults;

  const isChanged =
    setting?.quality !== defaults?.quality ||
    setting?.aspectRatio !== defaults?.aspectRatio;

  const autoLabel = tImg("auto");
  const qualityToken = (value: string): string =>
    RAW_QUALITY_PATTERN.test(value) ? value : tImg(value);

  const pillTokens = [
    aspectRatio && setting?.aspectRatio
      ? getAspectToken(setting.aspectRatio, autoLabel)
      : undefined,
    quality && setting?.quality ? qualityToken(setting.quality) : undefined,
  ].filter(Boolean);

  const isQualityLocked = quality !== undefined && quality.options.length === 1;

  const selectAspect = (option: ImageGenOption) => {
    setCurrentImageGenSetting({ ...setting, aspectRatio: option.value });
  };
  const selectQuality = (option: ImageGenOption) => {
    setCurrentImageGenSetting({ ...setting, quality: option.value });
  };

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1.5 rounded-pill border border-transparent px-2.5 py-1.5 text-[12.5px] text-ink-2 leading-none transition-colors duration-fast ease-canon",
            "hover:bg-paper-2 hover:text-ink",
            isChanged && "border-citrus bg-citrus-soft text-ink",
            "data-[state=open]:bg-paper-2 data-[state=open]:text-ink"
          )}
          type="button"
        >
          <SlidersHorizontal className="size-3.5" strokeWidth={1.6} />
          <span className="font-mono text-[11px]">
            {pillTokens.join(" · ")}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[300px] overflow-hidden rounded-md border border-rule bg-card p-0 text-popover-foreground shadow-pop"
        side="top"
        sideOffset={8}
      >
        <div className="flex items-center gap-2 border-rule border-b px-3 py-2.5">
          <ImageIcon
            className="size-3.5 shrink-0 text-citrus-deep"
            strokeWidth={1.6}
          />
          <span className="min-w-0 truncate font-mono text-[10px] text-ink-3 uppercase tracking-[0.1em]">
            <b className="font-medium text-ink">
              {tInput("imageSettingsHeader")}
            </b>{" "}
            · {tModels(model.name)}
          </span>
        </div>

        {aspectRatio && (
          <div className="px-3 py-2.5">
            <div className="flex items-baseline justify-between">
              <span className="font-medium text-[12.5px] text-ink-2">
                {tInput("imageFormat")}
              </span>
              {setting?.aspectRatio && (
                <span className="font-mono text-[10px] text-ink-3">
                  {getAspectToken(setting.aspectRatio, autoLabel)}
                </span>
              )}
            </div>
            <fieldset
              aria-label={tInput("imageFormat")}
              className="mt-2 grid grid-cols-5 gap-1"
            >
              {aspectRatio.options.map((option) => (
                <RatioTile
                  ariaLabel={tImg(option.labelKey)}
                  key={option.value}
                  onSelect={() => selectAspect(option)}
                  selected={setting?.aspectRatio === option.value}
                  token={getAspectToken(option.value, autoLabel)}
                  value={option.value}
                />
              ))}
            </fieldset>
          </div>
        )}

        {quality && (
          <div className="border-rule border-t px-3 py-2.5">
            <div className="flex items-baseline justify-between">
              <span className="font-medium text-[12.5px] text-ink-2">
                {tInput("imageQuality")}
              </span>
              {isQualityLocked && (
                <span className="font-mono text-[10px] text-ink-3">
                  {tInput("imageQualityOnly", {
                    value: qualityToken(quality.options[0].value),
                  })}
                </span>
              )}
            </div>
            <fieldset
              aria-label={tInput("imageQuality")}
              className="mt-2 flex flex-wrap gap-1"
            >
              <SettingChipRow
                ariaFor={(option) => tImg(option.labelKey)}
                locked={isQualityLocked}
                onSelect={selectQuality}
                options={quality.options}
                tokenFor={(option) => qualityToken(option.value)}
                value={setting?.quality}
              />
            </fieldset>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
