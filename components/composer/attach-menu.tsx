"use client";

import { Code2, FileText, ImageIcon, Paperclip } from "lucide-react";
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslations } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

export type AttachAccept = "image" | "document" | "code";

const ACCEPT_BY_KIND: Record<AttachAccept, string> = {
  image: "image/jpeg,image/png,image/webp",
  document: "application/pdf",
  code: "text/plain,.md,.ts,.tsx,.js,.jsx,.json,.css,.html",
};

const MOBILE_COMBINED_ACCEPT = [
  ACCEPT_BY_KIND.image,
  ACCEPT_BY_KIND.document,
  ACCEPT_BY_KIND.code,
].join(",");

type AttachMenuProps = {
  disabled?: boolean;
  onPick: (accept: string) => void;
};

export function AttachMenu({ disabled, onPick }: AttachMenuProps) {
  const tInput = useTranslations("chat.input");
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const items: {
    kind: AttachAccept;
    icon: React.ReactNode;
    name: string;
    desc: string;
    kbd?: string;
  }[] = [
    {
      kind: "image",
      icon: <ImageIcon className="size-3.5 text-ink-2" strokeWidth={1.6} />,
      name: tInput("attachPhoto"),
      desc: tInput("attachPhotoDesc"),
    },
    {
      kind: "document",
      icon: <FileText className="size-3.5 text-ink-2" strokeWidth={1.6} />,
      name: tInput("attachDocument"),
      desc: tInput("attachDocumentDesc"),
    },
    {
      kind: "code",
      icon: <Code2 className="size-3.5 text-ink-2" strokeWidth={1.6} />,
      name: tInput("attachCode"),
      desc: tInput("attachCodeDesc"),
    },
  ];

  if (isMobile) {
    return (
      <button
        aria-label={tInput("attachFile")}
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-pill border border-transparent text-ink-2 transition-colors duration-fast ease-canon",
          "hover:bg-paper-2 hover:text-ink",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
        data-testid="attachments-button"
        disabled={disabled}
        onClick={() => onPick(MOBILE_COMBINED_ACCEPT)}
        type="button"
      >
        <Paperclip className="size-3.5" strokeWidth={1.6} />
      </button>
    );
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          aria-label={tInput("attachFile")}
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-pill border border-transparent text-ink-2 transition-colors duration-fast ease-canon",
            "hover:bg-paper-2 hover:text-ink",
            "data-[state=open]:border-citrus data-[state=open]:bg-citrus-soft data-[state=open]:text-ink",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
          data-testid="attachments-button"
          disabled={disabled}
          type="button"
        >
          <Paperclip className="size-3.5" strokeWidth={1.6} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[240px] rounded-md border border-rule bg-card p-1 text-popover-foreground shadow-pop"
        side="top"
        sideOffset={8}
      >
        {items.map((item) => (
          <button
            className="grid w-full grid-cols-[24px_1fr_auto] items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-[13px] text-ink transition-colors hover:bg-paper-2"
            key={item.kind}
            onClick={() => {
              onPick(ACCEPT_BY_KIND[item.kind]);
              setOpen(false);
            }}
            type="button"
          >
            <span className="inline-flex size-6 items-center justify-center">
              {item.icon}
            </span>
            <span className="flex flex-col gap-0 leading-tight">
              <span className="text-[13px]">{item.name}</span>
              <span className="text-[11px] text-ink-3">{item.desc}</span>
            </span>
            {item.kbd && (
              <kbd className="rounded border border-rule bg-paper-2 px-1.5 py-[2px] font-mono text-[9px] text-ink-4">
                {item.kbd}
              </kbd>
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
