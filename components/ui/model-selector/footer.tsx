"use client";

import { useTranslations } from "@/lib/i18n/translate";

type FooterProps = {
  count: number;
};

export function Footer({ count }: FooterProps) {
  const t = useTranslations("modelList.footer");

  return (
    <div className="flex items-center justify-between border-rule border-t bg-card-sunk px-3.5 py-2 font-mono text-[9.5px] uppercase tracking-[0.08em] text-ink-3">
      <div className="hidden items-center gap-3 sm:flex">
        <span className="inline-flex items-center gap-1">
          <Kbd>esc</Kbd>
          <span>{t("close")}</span>
        </span>
      </div>
      <span className="ml-auto">{t("count", { count })}</span>
    </div>
  );
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded-xs border border-rule bg-card px-1.5 py-0.5 font-mono text-[9px] uppercase text-ink-3">
      {children}
    </kbd>
  );
}
