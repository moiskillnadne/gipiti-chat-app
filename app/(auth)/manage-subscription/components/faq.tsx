"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

const FAQ_ITEMS = ["q1", "q2", "q3", "q4", "q5", "q6"] as const;

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`size-5 shrink-0 text-gray-500 transition-transform duration-200 dark:text-zinc-400 ${
        isOpen ? "rotate-180" : ""
      }`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
    <div className="border-gray-200 border-b last:border-b-0 dark:border-zinc-700">
      <button
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800/50"
        onClick={onToggle}
        type="button"
      >
        <span className="font-medium text-gray-900 dark:text-zinc-100">
          {t(`${itemKey}.question`)}
        </span>
        <ChevronIcon isOpen={isOpen} />
      </button>
      <div
        className={`grid transition-all duration-200 ease-in-out ${
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <p className="px-4 pb-4 text-gray-600 dark:text-zinc-400">
            {t(`${itemKey}.answer`)}
          </p>
        </div>
      </div>
    </div>
  );
}

export function FAQ() {
  const t = useTranslations("auth.subscription.faq");
  const [openItem, setOpenItem] = useState<string | null>(null);

  const handleToggle = (itemKey: string) => {
    setOpenItem((prev) => (prev === itemKey ? null : itemKey));
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h4 className="mb-6 text-center font-medium text-gray-900 text-lg dark:text-zinc-100">
        {t("title")}
      </h4>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
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
