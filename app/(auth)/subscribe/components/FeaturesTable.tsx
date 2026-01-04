"use client";

import { useTranslations } from "next-intl";
import { CheckIcon } from "./CheckIcon";

type Period = "monthly" | "quarterly" | "annual";

const periods: Period[] = ["monthly", "quarterly", "annual"];

export function FeaturesTable() {
  const t = useTranslations("auth.subscription.features");

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h4 className="mb-6 text-center font-medium text-gray-900 text-lg dark:text-zinc-100">
        {t("title")}
      </h4>

      {/* Table container with horizontal scroll on mobile */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-700">
        <table className="w-full min-w-[500px] text-sm">
          {/* Header */}
          <thead>
            <tr className="border-gray-200 border-b bg-gray-50 dark:border-zinc-700 dark:bg-zinc-800/50">
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-zinc-400">
                {t("table.feature")}
              </th>
              {periods.map((period) => (
                <th
                  className="px-4 py-3 text-center font-medium text-gray-600 dark:text-zinc-400"
                  key={period}
                >
                  {t(`periods.${period}`)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
            {/* Tokens row */}
            <tr className="bg-white dark:bg-zinc-900">
              <td className="px-4 py-3 font-medium text-gray-900 dark:text-zinc-100">
                {t("table.tokens")}
              </td>
              {periods.map((period) => (
                <td
                  className="px-4 py-3 text-center text-gray-700 dark:text-zinc-300"
                  key={period}
                >
                  {t(`values.${period}.tokens`)}
                </td>
              ))}
            </tr>

            {/* Messages row */}
            <tr className="bg-gray-50/50 dark:bg-zinc-800/30">
              <td className="px-4 py-3 font-medium text-gray-900 dark:text-zinc-100">
                {t("table.messages")}
              </td>
              {periods.map((period) => (
                <td
                  className="px-4 py-3 text-center text-gray-700 dark:text-zinc-300"
                  key={period}
                >
                  {t(`values.${period}.messages`)}
                </td>
              ))}
            </tr>

            {/* Web searches row */}
            <tr className="bg-white dark:bg-zinc-900">
              <td className="px-4 py-3 font-medium text-gray-900 dark:text-zinc-100">
                {t("table.searches")}
              </td>
              {periods.map((period) => (
                <td
                  className="px-4 py-3 text-center text-gray-700 dark:text-zinc-300"
                  key={period}
                >
                  {t(`values.${period}.searches`)}
                </td>
              ))}
            </tr>

            {/* Models row - merged cell */}
            <tr className="bg-gray-50/50 dark:bg-zinc-800/30">
              <td className="px-4 py-3 font-medium text-gray-900 dark:text-zinc-100">
                {t("table.models")}
              </td>
              <td
                className="px-4 py-3 text-center text-gray-700 text-xs dark:text-zinc-300"
                colSpan={3}
              >
                {t("table.modelsList")}
              </td>
            </tr>

            {/* Reasoning row - checkmarks */}
            <tr className="bg-white dark:bg-zinc-900">
              <td className="px-4 py-3 font-medium text-gray-900 dark:text-zinc-100">
                {t("table.reasoning")}
              </td>
              {periods.map((period) => (
                <td className="px-4 py-3 text-center" key={period}>
                  <CheckIcon className="mx-auto text-emerald-500" />
                </td>
              ))}
            </tr>

            {/* Image generation row - merged cell */}
            <tr className="bg-gray-50/50 dark:bg-zinc-800/30">
              <td className="px-4 py-3 font-medium text-gray-900 dark:text-zinc-100">
                {t("table.imageGeneration")}
              </td>
              <td
                className="px-4 py-3 text-center text-gray-700 text-xs dark:text-zinc-300"
                colSpan={3}
              >
                {t("table.imageModels")}
              </td>
            </tr>

            {/* File analysis row - merged cell */}
            <tr className="bg-white dark:bg-zinc-900">
              <td className="px-4 py-3 font-medium text-gray-900 dark:text-zinc-100">
                {t("table.fileAnalysis")}
              </td>
              <td
                className="px-4 py-3 text-center text-gray-700 dark:text-zinc-300"
                colSpan={3}
              >
                {t("table.fileTypes")}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
