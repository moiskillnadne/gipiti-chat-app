"use client";

import { Plug } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { listMyIntegrations } from "@/app/integrations/actions";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supportsMcp } from "@/lib/ai/models";
import { useTranslations } from "@/lib/i18n/translate";
import { MAX_SELECTED_INTEGRATIONS } from "@/lib/integrations/ui";
import { cn } from "@/lib/utils";

type IntegrationsPickerProps = {
  modelId: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

export function IntegrationsPicker({
  modelId,
  selectedIds,
  onChange,
}: IntegrationsPickerProps) {
  const t = useTranslations("integrations.picker");
  const [open, setOpen] = useState(false);
  const isSupported = supportsMcp(modelId);
  const { data: connections = [] } = useSWR(
    "my-integrations",
    listMyIntegrations,
    { revalidateOnFocus: false }
  );

  const selected = connections.filter((c) => selectedIds.includes(c.id));
  const isActive = isSupported && selected.length > 0;
  const isLimitReached = selectedIds.length >= MAX_SELECTED_INTEGRATIONS;

  const toggle = (id: string, checked: boolean) => {
    onChange(
      checked ? [...selectedIds, id] : selectedIds.filter((x) => x !== id)
    );
  };

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          aria-pressed={isActive}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-pill border border-transparent px-2.5 py-1.5 text-[12.5px] text-ink-2 leading-none transition-colors duration-fast ease-canon",
            "hover:bg-paper-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50",
            isActive && "border-citrus bg-citrus-soft text-ink"
          )}
          type="button"
        >
          <Plug className="size-3.5" strokeWidth={1.6} />
          <span>
            {isActive
              ? t("triggerCount", { count: selected.length })
              : t("trigger")}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 overflow-hidden rounded-lg border border-rule bg-card p-0 text-popover-foreground shadow-pop"
        sideOffset={6}
      >
        {isSupported ? null : (
          <p className="border-rule border-b px-3 py-2.5 text-[12.5px] text-ink-3">
            {t("unsupportedModel")}
          </p>
        )}
        {connections.length === 0 ? (
          <p className="px-3 py-3 text-[13px] text-ink-3">
            {t("empty")}{" "}
            <Link className="text-ink underline" href="/integrations">
              {t("manage")}
            </Link>
          </p>
        ) : (
          <ul className="max-h-64 overflow-y-auto py-1">
            {connections.map((connection) => {
              const checked = selectedIds.includes(connection.id);
              return (
                <li key={connection.id}>
                  <label
                    className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-paper-2"
                    htmlFor={`integration-${connection.id}`}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={!isSupported || (!checked && isLimitReached)}
                      id={`integration-${connection.id}`}
                      onCheckedChange={(value) =>
                        toggle(connection.id, value === true)
                      }
                    />
                    <span className="flex-1 truncate text-[13px] text-ink">
                      {connection.displayName}
                    </span>
                    <span className="font-mono text-[11px] text-ink-4">
                      {t("tokens", { count: connection.toolTokenEstimate })}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <p className="border-rule border-t px-3 py-2 text-[11.5px] text-ink-3">
          {t("midChatHint")}
        </p>
      </PopoverContent>
    </Popover>
  );
}
