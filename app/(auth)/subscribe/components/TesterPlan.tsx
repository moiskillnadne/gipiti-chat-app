"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/config";
import { formatPrice } from "../utils/payment-utils";

export function TesterPlan() {
  const t = useTranslations("auth.subscription");
  const locale = useLocale() as Locale;

  return (
    <div className="mx-auto max-w-md">
      <div className="relative flex flex-col rounded-2xl border-2 border-blue-500 bg-blue-50/50 p-6 text-left dark:border-blue-400 dark:bg-blue-950/30">
        <span className="-top-3 absolute right-4 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-3 py-1 font-medium text-white text-xs">
          Tester
        </span>

        <div className="mb-4">
          <h3 className="font-semibold text-xl dark:text-zinc-50">
            {t("tester.name")}
          </h3>
        </div>

        <div className="mb-4">
          <span className="font-bold text-4xl dark:text-zinc-50">
            {formatPrice("tester_paid", locale)}
          </span>
          <span className="text-gray-500 dark:text-zinc-400">
            {t("tester.period")}
          </span>
        </div>

        <p className="text-gray-600 text-sm dark:text-zinc-400">
          {t("tester.description")}
        </p>
      </div>
    </div>
  );
}

