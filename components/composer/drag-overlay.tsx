"use client";

import { Upload } from "lucide-react";
import { useTranslations } from "@/lib/i18n/translate";

export function DragOverlay() {
  const tInput = useTranslations("chat.input");
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-[20px] border-2 border-citrus-deep border-dashed bg-white/60 font-medium text-[14px] text-ink backdrop-blur-[4px]"
    >
      <Upload className="size-[22px] text-citrus-deep" strokeWidth={1.6} />
      <div>{tInput("dropFiles")}</div>
      <div className="font-mono font-normal text-[10px] text-ink-3 uppercase tracking-[0.1em]">
        {tInput("dropFilesSub")}
      </div>
    </div>
  );
}
