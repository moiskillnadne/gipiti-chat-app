"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useStyle } from "@/contexts/style-context";
import { cn } from "@/lib/utils";

import { CheckCircleFillIcon, ChevronDownIcon, PenIcon } from "./icons";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";

export function StyleSelector() {
  const [open, setOpen] = useState(false);
  const { currentStyleId, setStyleId, styles, isLoading } = useStyle();
  const t = useTranslations("textStyles");

  const currentStyle = styles.find((s) => s.id === currentStyleId);

  const handleStyleChange = (value: string) => {
    setStyleId(value === "none" ? null : value);
    setOpen(false);
  };

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          className="gap-2 px-3"
          data-testid="style-selector-trigger"
          variant="outline"
        >
          <PenIcon size={16} />
          <span className="text-sm">
            {currentStyle ? currentStyle.name : t("noStyle")}
          </span>
          <span
            className={cn(
              "transition-transform duration-200",
              open && "rotate-180"
            )}
          >
            <ChevronDownIcon size={16} />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[280px] rounded-2xl p-0 shadow-lg"
      >
        <div className="max-h-[320px] overflow-y-scroll">
          <RadioGroup
            className="gap-0"
            onValueChange={handleStyleChange}
            value={currentStyleId ?? "none"}
          >
            <label
              className={cn(
                "group flex min-h-[44px] cursor-pointer items-start gap-3 px-3 py-2.5 transition-colors hover:bg-accent",
                !currentStyleId && "bg-accent/50"
              )}
              htmlFor="style-none"
            >
              <RadioGroupItem
                className="sr-only"
                id="style-none"
                value="none"
              />
              <div className="flex-1">
                <div className="font-medium text-sm leading-tight">
                  {t("noStyle")}
                </div>
                <div className="mt-0.5 text-muted-foreground text-xs leading-snug">
                  {t("noStyleDescription")}
                </div>
              </div>
              {!currentStyleId && (
                <span className="mt-0.5 flex-shrink-0 text-primary">
                  <CheckCircleFillIcon size={18} />
                </span>
              )}
            </label>

            {!isLoading && styles.length > 0 && (
              <div className="border-border border-t" />
            )}

            {styles.map((style) => {
              const isSelected = currentStyleId === style.id;
              return (
                <label
                  className={cn(
                    "group flex min-h-[44px] cursor-pointer items-start gap-3 px-3 py-2.5 transition-colors hover:bg-accent",
                    isSelected && "bg-accent/50"
                  )}
                  htmlFor={`style-${style.id}`}
                  key={style.id}
                >
                  <RadioGroupItem
                    className="sr-only"
                    id={`style-${style.id}`}
                    value={style.id}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm leading-tight">
                      {style.name}
                    </div>
                    <div className="mt-0.5 text-muted-foreground text-xs leading-snug">
                      {t("exampleCount", { count: style.examples.length })}
                    </div>
                  </div>
                  {isSelected && (
                    <span className="mt-0.5 flex-shrink-0 text-primary">
                      <CheckCircleFillIcon size={18} />
                    </span>
                  )}
                </label>
              );
            })}
          </RadioGroup>
        </div>

        <div className="border-border border-t px-3 py-2">
          <Link
            className="text-muted-foreground text-xs hover:text-foreground hover:underline"
            href="/styles"
            onClick={() => setOpen(false)}
          >
            {t("manageStyles")}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
