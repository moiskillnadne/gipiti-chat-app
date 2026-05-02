"use client";

import { useTranslations } from "@/lib/i18n/translate";
import { CheckIcon } from "./check-icon";

type Period = "monthly" | "quarterly" | "annual";

const periods: Period[] = ["monthly", "quarterly", "annual"];

export function FeaturesTable() {
  const t = useTranslations("auth.subscription.features");

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h4 className="mb-6 text-center font-medium text-gray-900 text-lg">
        {t("title")}
      </h4>

      {/* Table container with horizontal scroll on mobile */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full min-w-[500px] text-sm">
          {/* Header */}
          <thead>
            <tr className="border-gray-200 border-b bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                {t("table.feature")}
              </th>
              {periods.map((period) => (
                <th
                  className="px-4 py-3 text-center font-medium text-gray-600"
                  key={period}
                >
                  {t(`periods.${period}`)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200">
            {/* Tokens row */}
            <tr className="bg-white">
              <td className="px-4 py-3 font-medium text-gray-900">
                {t("table.tokens")}
              </td>
              {periods.map((period) => (
                <td
                  className="px-4 py-3 text-center text-gray-700"
                  key={period}
                >
                  {t(`values.${period}.tokens`)}
                </td>
              ))}
            </tr>

            {/* Messages row */}
            <tr className="bg-gray-50/50">
              <td className="px-4 py-3 font-medium text-gray-900">
                {t("table.messages")}
              </td>
              {periods.map((period) => (
                <td
                  className="px-4 py-3 text-center text-gray-700"
                  key={period}
                >
                  {t(`values.${period}.messages`)}
                </td>
              ))}
            </tr>

            {/* Web searches row */}
            <tr className="bg-white">
              <td className="px-4 py-3 font-medium text-gray-900">
                {t("table.searches")}
              </td>
              {periods.map((period) => (
                <td
                  className="px-4 py-3 text-center text-gray-700"
                  key={period}
                >
                  {t(`values.${period}.searches`)}
                </td>
              ))}
            </tr>

            {/* Models row - merged cell */}
            <tr className="bg-gray-50/50">
              <td className="px-4 py-3 font-medium text-gray-900">
                {t("table.models")}
              </td>
              <td
                className="px-4 py-3 text-center text-gray-700 text-xs"
                colSpan={3}
              >
                {t("table.modelsList")}
              </td>
            </tr>

            {/* Reasoning row - checkmarks */}
            <tr className="bg-white">
              <td className="px-4 py-3 font-medium text-gray-900">
                {t("table.reasoning")}
              </td>
              {periods.map((period) => (
                <td className="px-4 py-3 text-center" key={period}>
                  <CheckIcon className="mx-auto text-emerald-500" />
                </td>
              ))}
            </tr>

            {/* Image generation row - merged cell */}
            <tr className="bg-gray-50/50">
              <td className="px-4 py-3 font-medium text-gray-900">
                {t("table.imageGeneration")}
              </td>
              <td
                className="px-4 py-3 text-center text-gray-700 text-xs"
                colSpan={3}
              >
                {t("table.imageModels")}
              </td>
            </tr>

            {/* Video generation row */}
            <tr className="bg-white">
              <td className="px-4 py-3 font-medium text-gray-900">
                {t("table.videoGeneration")}
              </td>
              {periods.map((period) => (
                <td
                  className="px-4 py-3 text-center text-gray-700"
                  key={period}
                >
                  {t(`values.${period}.videoGenerations`)}
                </td>
              ))}
            </tr>

            {/* File analysis row - merged cell */}
            <tr className="bg-white">
              <td className="px-4 py-3 font-medium text-gray-900">
                {t("table.fileAnalysis")}
              </td>
              <td className="px-4 py-3 text-center text-gray-700" colSpan={3}>
                {t("table.fileTypes")}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
