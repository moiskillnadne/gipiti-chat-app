import { getTranslations } from "@/lib/i18n/translate";
import type { BillingPeriodKey } from "@/lib/subscription/get-latest-subscription";
import dash from "../../_components/dashboard.module.css";
import styles from "./manage.module.css";

type TariffCardProps = {
  displayName: string;
  periodKey: BillingPeriodKey;
  /** Formatted plan price with period suffix, e.g. "1 999 ₽/мес". */
  priceText: string;
  /** Formatted monthly balance grant (equals the plan price, 1:1). */
  grantText: string;
};

export async function TariffCard({
  displayName,
  periodKey,
  priceText,
  grantText,
}: TariffCardProps) {
  const [t, tPlan] = await Promise.all([
    getTranslations("auth.subscription.manage.tariff"),
    getTranslations("auth.subscription.balance.plan"),
  ]);

  return (
    <section aria-label={t("title")} className={dash.card}>
      <div className={dash.cardHead}>
        <h3 className={dash.cardTitle}>{t("title")}</h3>
        <span className={dash.cardMeta}>{t("meta")}</span>
      </div>

      <div className={`${dash.planRow} ${styles.planRowBare}`}>
        <span className={dash.planNm}>
          {displayName}
          <span className={dash.planNmEm}>{tPlan(`period.${periodKey}`)}</span>
        </span>
        <span className={dash.planPr}>
          {t("priceLabel")}
          <b>{priceText}</b>
        </span>
      </div>

      <p className={styles.tariffHint}>
        {t(`hint.${periodKey}`, { grant: grantText })}
      </p>
    </section>
  );
}
