import { getTranslations } from "@/lib/i18n/translate";
import dash from "../../_components/dashboard.module.css";
import { CardIcon } from "../../_components/icons";
import styles from "./manage.module.css";

type PaymentMethodCardProps = {
  cardMask: string | null;
  isCancelled: boolean;
  /** Formatted next charge date; null when unknown. */
  nextPaymentDate: string | null;
  /** Formatted plan price, e.g. "1 999 ₽". */
  priceText: string;
};

export async function PaymentMethodCard({
  cardMask,
  isCancelled,
  nextPaymentDate,
  priceText,
}: PaymentMethodCardProps) {
  const t = await getTranslations("auth.subscription.manage.payment");

  return (
    <section aria-label={t("title")} className={dash.card}>
      <div className={dash.cardHead}>
        <h3 className={dash.cardTitle}>{t("title")}</h3>
        <span className={dash.cardMeta}>{t("meta")}</span>
      </div>

      <div className={styles.cardRow}>
        <span className={styles.cardChip}>
          <CardIcon aria-label={t("title")} />
        </span>
        <div className={styles.cardTx}>
          <b>{cardMask ?? t("noCard")}</b>
        </div>
      </div>

      <div className={dash.planKvList}>
        <div className={dash.planKv}>
          <span className={dash.planKvK}>{t("nextPayment")}</span>
          {isCancelled ? (
            <span className={`${dash.planKvV} ${styles.mutedV}`}>
              {t("cancelledNote")}
            </span>
          ) : (
            <span className={dash.planKvV}>
              {nextPaymentDate ?? "—"}
              {" · "}
              <span className={dash.planKvVMono}>{priceText}</span>
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
