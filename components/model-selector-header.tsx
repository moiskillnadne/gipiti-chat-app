"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useModel } from "@/contexts/model-context";
import { cn } from "@/lib/utils";
import { CheckCircleFillIcon, ChevronDownIcon, CpuIcon } from "./icons";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export function ModelSelectorHeader({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const { currentModelId, setModelId, availableModels, getModelById } =
    useModel();

  const t = useTranslations("modelList");

  const selectedModel = useMemo(
    () => getModelById(currentModelId),
    [currentModelId, getModelById]
  );

  if (availableModels.length === 0) {
    return null;
  }

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <DropdownMenuTrigger asChild>
        <Button
          className={cn(
            "h-8 gap-1.5 border-0 bg-background px-2 text-foreground shadow-none transition-colors hover:bg-accent md:gap-2 md:px-3",
            "data-[state=open]:bg-accent",
            className
          )}
          size="sm"
          type="button"
          variant="outline"
        >
          <CpuIcon size={16} />
          <span className="hidden font-medium text-xs sm:inline">
            {selectedModel ? t(selectedModel.name) : "Select Model"}
          </span>
          <ChevronDownIcon size={14} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-[280px] max-w-[90vw] sm:min-w-[300px]"
      >
        {availableModels.map((model) => {
          const isSelected = model.id === currentModelId;

          return (
            <DropdownMenuItem
              asChild
              data-active={isSelected}
              key={model.id}
              onSelect={() => {
                setOpen(false);
                setModelId(model.id);
              }}
            >
              <button
                className="group/item flex w-full flex-row items-center justify-between gap-2 sm:gap-4"
                type="button"
              >
                <div className="flex flex-col items-start gap-1">
                  <div className="text-sm sm:text-base">{t(model.name)}</div>
                  <div className="line-clamp-2 text-muted-foreground text-xs">
                    {t(model.description)}
                  </div>
                </div>

                <div className="shrink-0 text-foreground opacity-0 group-data-[active=true]/item:opacity-100">
                  <CheckCircleFillIcon />
                </div>
              </button>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
