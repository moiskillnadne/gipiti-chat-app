"use client";

import { useState } from "react";
import { useTranslations } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import { ChevronIcon } from "./plan-icons";

const FAQ_ITEMS = ["q1", "q2", "q3", "q4", "q5", "q6"] as const;

function FAQItem({
  itemKey,
  isOpen,
  onToggle,
}: {
  itemKey: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("auth.subscription.faq.items");

  return (
    <div className="border-rule border-b">
      <button
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-5 px-1 py-[22px] text-left font-medium text-[17px] text-ink tracking-[-0.01em]"
        onClick={onToggle}
        type="button"
      >
        <span>{t(`${itemKey}.question`)}</span>
        <ChevronIcon
          className={cn(
            "size-5 shrink-0 text-ink-3 transition-transform duration-base ease-canon",
            isOpen && "rotate-180 text-ink"
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-all duration-base ease-canon",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <p className="max-w-[68ch] whitespace-pre-line pr-14 pb-6 pl-1 text-[15px] text-ink-2 leading-[1.6]">
            {t(`${itemKey}.answer`)}
          </p>
        </div>
      </div>
    </div>
  );
}

export function FAQ() {
  const t = useTranslations("auth.subscription.faq");
  const [openItem, setOpenItem] = useState<string | null>(FAQ_ITEMS[0]);

  const handleToggle = (itemKey: string) => {
    setOpenItem((prev) => (prev === itemKey ? null : itemKey));
  };

  return (
    <div className="mx-auto w-full max-w-[880px]">
      <h2 className="mb-7 text-center font-medium text-[30px] text-ink tracking-[-0.025em]">
        {t("title")}
      </h2>

      <div className="border-rule border-t">
        {FAQ_ITEMS.map((itemKey) => (
          <FAQItem
            isOpen={openItem === itemKey}
            itemKey={itemKey}
            key={itemKey}
            onToggle={() => handleToggle(itemKey)}
          />
        ))}
      </div>
    </div>
  );
}
