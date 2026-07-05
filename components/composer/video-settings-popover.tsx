"use client";

import { SlidersHorizontal, VideoIcon } from "lucide-react";
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useModel } from "@/contexts/model-context";
import {
  getDefaultVideoGenSetting,
  getModelById,
  type ImageGenOption,
  supportsVideoGenConfig,
  type VideoGenSetting,
} from "@/lib/ai/models";
import { useTranslations } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import {
  getAspectToken,
  RatioTile,
  SettingChipRow,
} from "./media-settings-controls";

const SETTING_KEYS = ["aspectRatio", "duration", "resolution", "mode"] as const;

/**
 * Model-dependent video generation settings (format, clip length, resolution
 * or render mode) in the composer toolbar. Sections come from the model's
 * VideoGenConfig; models without one render no pill. Image-to-video models
 * have no format section — the output follows the input image.
 */
export function VideoSettingsPopover() {
  const tInput = useTranslations("chat.input");
  const tImg = useTranslations("imageGenSetting");
  const tModels = useTranslations("modelList");
  const { currentModelId, currentVideoGenSetting, setCurrentVideoGenSetting } =
    useModel();
  const [open, setOpen] = useState(false);

  const model = getModelById(currentModelId);
  if (!(supportsVideoGenConfig(currentModelId) && model?.videoGenConfig)) {
    return null;
  }

  const config = model.videoGenConfig;
  const defaults = getDefaultVideoGenSetting(currentModelId);
  const setting = currentVideoGenSetting ?? defaults;

  const isChanged = SETTING_KEYS.some(
    (key) => setting?.[key] !== defaults?.[key]
  );

  const autoLabel = tImg("auto");
  const durationToken = (value: string): string =>
    tInput("videoSeconds", { value });

  const pillTokens = [
    config.aspectRatio && setting?.aspectRatio
      ? getAspectToken(setting.aspectRatio, autoLabel)
      : undefined,
    config.duration && setting?.duration
      ? durationToken(setting.duration)
      : undefined,
  ].filter(Boolean);

  const select = (key: (typeof SETTING_KEYS)[number], value: string) => {
    setCurrentVideoGenSetting({ ...setting, [key]: value } as VideoGenSetting);
  };

  const chipSection = (
    key: "duration" | "resolution" | "mode",
    title: string,
    tokenFor: (option: ImageGenOption) => string
  ) => {
    const section = config[key];
    if (!section) {
      return null;
    }
    return (
      <div className="border-rule border-t px-3 py-2.5">
        <div className="flex items-baseline justify-between">
          <span className="font-medium text-[12.5px] text-ink-2">{title}</span>
        </div>
        <fieldset aria-label={title} className="mt-2 flex flex-wrap gap-1">
          <SettingChipRow
            ariaFor={(option) => tImg(option.labelKey)}
            onSelect={(option) => select(key, option.value)}
            options={section.options}
            tokenFor={tokenFor}
            value={setting?.[key]}
          />
        </fieldset>
      </div>
    );
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
        <div className="flex items-center gap-2 px-3 py-2.5">
          <VideoIcon
            className="size-3.5 shrink-0 text-citrus-deep"
            strokeWidth={1.6}
          />
          <span className="min-w-0 truncate font-mono text-[10px] text-ink-3 uppercase tracking-[0.1em]">
            <b className="font-medium text-ink">
              {tInput("videoSettingsHeader")}
            </b>{" "}
            · {tModels(model.name)}
          </span>
        </div>

        {config.aspectRatio && (
          <div className="border-rule border-t px-3 py-2.5">
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
              {config.aspectRatio.options.map((option) => (
                <RatioTile
                  ariaLabel={tImg(option.labelKey)}
                  key={option.value}
                  onSelect={() => select("aspectRatio", option.value)}
                  selected={setting?.aspectRatio === option.value}
                  token={getAspectToken(option.value, autoLabel)}
                  value={option.value}
                />
              ))}
            </fieldset>
          </div>
        )}

        {chipSection("duration", tInput("videoDuration"), (option) =>
          durationToken(option.value)
        )}
        {chipSection(
          "resolution",
          tInput("videoResolution"),
          (option) => option.value
        )}
        {chipSection("mode", tInput("imageQuality"), (option) =>
          tImg(option.labelKey)
        )}
      </PopoverContent>
    </Popover>
  );
}
