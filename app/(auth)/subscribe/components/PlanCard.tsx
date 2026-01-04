import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { PlanType } from "../hooks/payment-reducer";

type PlanCardProps = {
  plan: PlanType;
  onSubscribe: (plan: PlanType) => void;
  isLoading: boolean;
  isDisabled: boolean;
  badge?: string;
  nameKey: string;
  periodKey: string;
  descriptionKey: string;
  formattedPrice: string;
  canStartTrial?: boolean;
  trialDays?: number;
  isRecommended?: boolean;
  subscribeButtonKey?: string;
};

export function PlanCard({
  plan,
  onSubscribe,
  isLoading,
  isDisabled,
  badge,
  nameKey,
  periodKey,
  descriptionKey,
  formattedPrice,
  canStartTrial = false,
  trialDays = 3,
  isRecommended = false,
  subscribeButtonKey = "subscribeButton",
}: PlanCardProps) {
  const t = useTranslations("auth.subscription");

  const handleClick = () => {
    if (!isLoading && !isDisabled) {
      onSubscribe(plan);
    }
  };

  return (
    <div
      className={`relative flex flex-col rounded-2xl border-2 p-6 text-left transition-all ${
        isRecommended
          ? "border-blue-500 bg-blue-50/50 dark:border-blue-400 dark:bg-blue-950/30"
          : "border-gray-200 dark:border-zinc-700"
      }`}
    >
      {/* Show trial badge if trial available, otherwise show regular badge */}
      {canStartTrial ? (
        <span className="-top-3 absolute right-4 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 px-3 py-1 font-medium text-white text-xs">
          {t("trial.badgeShort", { days: trialDays })}
        </span>
      ) : (
        badge && (
          <span className="-top-3 absolute right-4 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-1 font-medium text-white text-xs">
            {badge}
          </span>
        )
      )}

      <div className="mb-4">
        <h3 className="font-semibold text-xl dark:text-zinc-50">
          {t(nameKey)}
        </h3>
      </div>

      <div className="mb-4">
        <span className="font-bold text-4xl dark:text-zinc-50">
          {formattedPrice}
        </span>
        <span className="text-gray-500 dark:text-zinc-400">{t(periodKey)}</span>
      </div>

      <p className="mb-6 flex-1 text-gray-600 text-sm dark:text-zinc-400">
        {canStartTrial
          ? t("trial.descriptionWithPrice", {
              days: trialDays,
              price: formattedPrice,
            })
          : t(descriptionKey)}
      </p>

      <Button
        className={`w-full ${
          canStartTrial
            ? "bg-purple-600 hover:bg-purple-700"
            : "bg-blue-600 hover:bg-blue-700"
        }`}
        disabled={isLoading || isDisabled}
        onClick={handleClick}
        type="button"
      >
        {isLoading
          ? t("subscribing")
          : canStartTrial
            ? t("trial.startButton")
            : t(subscribeButtonKey)}
      </Button>
    </div>
  );
}
