import { getTranslations } from "@/lib/i18n/translate";
import dash from "../../_components/dashboard.module.css";

type ManageHeaderProps = {
  isCancelled: boolean;
  /** Full access-until date for the cancelled state, e.g. "1 июня 2026 г." */
  accessUntil: string | null;
  /** Billing-cycle range for the active state, e.g. "1 — 31 мая 2026 г." */
  cycleRange: string | null;
};

export async function ManageHeader({
  isCancelled,
  accessUntil,
  cycleRange,
}: ManageHeaderProps) {
  const t = await getTranslations("auth.subscription.manage.header");

  const cycleLabel = isCancelled ? t("cycleAccessUntil") : t("cyclePeriod");
  const cycleValue = isCancelled ? accessUntil : cycleRange;

  return (
    <header className={dash.head}>
      <div>
        <h1 className={dash.headTitle}>
          {t("title")}
          <em>{t("em")}</em>
        </h1>
        <p className={dash.headLede}>{t("lede")}</p>
      </div>
      {cycleValue && (
        <div className={dash.cycle}>
          {cycleLabel}
          <b>{cycleValue}</b>
        </div>
      )}
    </header>
  );
}
