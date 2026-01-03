import { useTranslations } from "next-intl";
import type { PlanType } from "../hooks/payment-reducer";
import { CheckIcon } from "./CheckIcon";

type PlanCardProps = {
  plan: PlanType;
  isSelected: boolean;
  onSelect: (plan: PlanType) => void;
  badge?: string;
  nameKey: string;
  periodKey: string;
  descriptionKey: string;
  formattedPrice: string;
};

export function PlanCard({
  plan,
  isSelected,
  onSelect,
  badge,
  nameKey,
  periodKey,
  descriptionKey,
  formattedPrice,
}: PlanCardProps) {
  const t = useTranslations("auth.subscription");

  return (
    <button
      className={`relative flex cursor-pointer flex-col rounded-2xl border-2 p-6 text-left transition-all ${
        isSelected
          ? "border-blue-500 bg-blue-50/50 dark:border-blue-400 dark:bg-blue-950/30"
          : "border-gray-200 hover:border-gray-300 dark:border-zinc-700 dark:hover:border-zinc-600"
      }`}
      onClick={() => onSelect(plan)}
      type="button"
    >
      {badge && (
        <span className="-top-3 absolute right-4 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-1 font-medium text-white text-xs">
          {badge}
        </span>
      )}

      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-xl dark:text-zinc-50">{t(nameKey)}</h3>
        <div
          className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
            isSelected
              ? "border-blue-500 bg-blue-500"
              : "border-gray-300 dark:border-zinc-600"
          }`}
        >
          {isSelected && <CheckIcon className="text-white" />}
        </div>
      </div>

      <div className="mb-4">
        <span className="font-bold text-4xl dark:text-zinc-50">
          {formattedPrice}
        </span>
        <span className="text-gray-500 dark:text-zinc-400">{t(periodKey)}</span>
      </div>

      <p className="text-gray-600 text-sm dark:text-zinc-400">
        {t(descriptionKey)}
      </p>
    </button>
  );
}

