"use client";

import { useTranslations } from "next-intl";
import { CheckIcon } from "./CheckIcon";

export function FeaturesList() {
  const t = useTranslations("auth.subscription");

  return (
    <div className="mx-auto max-w-md">
      <h4 className="mb-4 text-center font-medium text-gray-900 dark:text-zinc-100">
        {t("features.title")}
      </h4>
      <ul className="space-y-3">
        <li className="flex items-center gap-3">
          <CheckIcon className="text-emerald-500" />
          <span className="text-gray-600 text-sm dark:text-zinc-400">
            {t("features.models")}
          </span>
        </li>
        <li className="flex items-center gap-3">
          <CheckIcon className="text-emerald-500" />
          <span className="text-gray-600 text-sm dark:text-zinc-400">
            {t("features.search")}
          </span>
        </li>
        <li className="flex items-center gap-3">
          <CheckIcon className="text-emerald-500" />
          <span className="text-gray-600 text-sm dark:text-zinc-400">
            {t("features.fileSize")}
          </span>
        </li>
      </ul>
    </div>
  );
}

