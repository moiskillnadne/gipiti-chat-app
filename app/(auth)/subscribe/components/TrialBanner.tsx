"use client";

import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import type { PlanType } from "../hooks/payment-reducer";
import { formatPrice } from "../utils/payment-utils";

type TrialBannerProps = {
  selectedPlan: PlanType;
  isLoading: boolean;
  onStartTrial: () => void;
};

export function TrialBanner({
  selectedPlan,
  isLoading,
  onStartTrial,
}: TrialBannerProps) {
  const t = useTranslations("auth.subscription");
  const locale = useLocale() as Locale;

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="relative overflow-hidden rounded-2xl border-2 border-purple-500 bg-gradient-to-br from-purple-50 to-indigo-50 p-6 dark:border-purple-400 dark:from-purple-950/30 dark:to-indigo-950/30">
        <div className="-translate-y-8 absolute top-0 right-0 h-24 w-24 translate-x-8 rounded-full bg-purple-200/50 dark:bg-purple-800/20" />
        <div className="-translate-x-4 absolute bottom-0 left-0 h-16 w-16 translate-y-4 rounded-full bg-indigo-200/50 dark:bg-indigo-800/20" />
        <div className="relative">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full bg-purple-500 px-2 py-0.5 font-medium text-white text-xs">
              {t("trial.badge")}
            </span>
          </div>
          <h3 className="mb-2 font-bold text-gray-900 text-xl dark:text-zinc-50">
            {t("trial.title")}
          </h3>
          <p className="mb-4 text-gray-600 text-sm dark:text-zinc-400">
            {t("trial.description", {
              price: formatPrice(selectedPlan, locale),
            })}
          </p>
          <Button
            className="w-full bg-purple-600 py-5 text-base hover:bg-purple-700"
            disabled={isLoading}
            onClick={onStartTrial}
            size="lg"
          >
            {isLoading ? t("subscribing") : t("trial.startButton")}
          </Button>
          <p className="mt-3 text-center text-gray-500 text-xs dark:text-zinc-500">
            {t("trial.hint")}
          </p>
        </div>
      </div>
      <div className="my-6 flex items-center gap-4">
        <div className="h-px flex-1 bg-gray-200 dark:bg-zinc-700" />
        <span className="text-gray-400 text-sm dark:text-zinc-500">
          {t("trial.orPayNow")}
        </span>
        <div className="h-px flex-1 bg-gray-200 dark:bg-zinc-700" />
      </div>
    </div>
  );
}

