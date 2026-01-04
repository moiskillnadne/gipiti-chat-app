"use client";

import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import { formatPrice } from "../utils/payment-utils";

type TesterPlanProps = {
  onSubscribe: () => void;
  canStartTrial?: boolean;
  isLoading: boolean;
  trialDays?: number;
};

export function TesterPlan({
  onSubscribe,
  canStartTrial = false,
  isLoading,
  trialDays = 3,
}: TesterPlanProps) {
  const t = useTranslations("auth.subscription");
  const locale = useLocale() as Locale;
  const formattedPrice = formatPrice("tester_paid", locale);

  return (
    <div className="mx-auto max-w-md">
      <div className="relative flex flex-col rounded-2xl border-2 border-blue-500 bg-blue-50/50 p-6 text-left dark:border-blue-400 dark:bg-blue-950/30">
        {/* Show trial badge if trial available, otherwise show Tester badge */}
        {canStartTrial ? (
          <span className="-top-3 absolute right-4 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 px-3 py-1 font-medium text-white text-xs">
            {t("trial.badgeShort", { days: trialDays })}
          </span>
        ) : (
          <span className="-top-3 absolute right-4 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-3 py-1 font-medium text-white text-xs">
            Tester
          </span>
        )}

        <div className="mb-4">
          <h3 className="font-semibold text-xl dark:text-zinc-50">
            {t("tester.name")}
          </h3>
        </div>

        <div className="mb-4">
          <span className="font-bold text-4xl dark:text-zinc-50">
            {formattedPrice}
          </span>
          <span className="text-gray-500 dark:text-zinc-400">
            {t("tester.period")}
          </span>
        </div>

        <p className="mb-6 text-gray-600 text-sm dark:text-zinc-400">
          {canStartTrial
            ? t("trial.descriptionWithPrice", {
                days: trialDays,
                price: formattedPrice,
              })
            : t("tester.description")}
        </p>

        <Button
          className={`w-full ${
            canStartTrial
              ? "bg-purple-600 hover:bg-purple-700"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
          disabled={isLoading}
          onClick={onSubscribe}
          type="button"
        >
          {isLoading
            ? t("subscribing")
            : canStartTrial
              ? t("trial.startButton")
              : t("subscribeButton")}
        </Button>
      </div>
    </div>
  );
}
