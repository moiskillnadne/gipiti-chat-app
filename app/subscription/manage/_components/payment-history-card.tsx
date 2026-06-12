import { formatCurrency } from "@/lib/billing/money";
import type { CardPayment } from "@/lib/billing/payment-history";
import { getTranslations } from "@/lib/i18n/translate";
import { formatRuDateTime, formatRuMonth } from "@/lib/utils/format-billing";
import dash from "../../_components/dashboard.module.css";
import { PlusIcon, RefreshIcon } from "../../_components/icons";
import styles from "./manage.module.css";

type PaymentHistoryCardProps = {
  payments: CardPayment[];
  planDisplayName: string;
  cardMask: string | null;
  currencyCode: string;
  minorUnits: number;
};

export async function PaymentHistoryCard({
  payments,
  planDisplayName,
  cardMask,
  currencyCode,
  minorUnits,
}: PaymentHistoryCardProps) {
  const t = await getTranslations("auth.subscription.manage.history");

  return (
    <section aria-label={t("title")} className={dash.card}>
      <div className={dash.cardHead}>
        <h3 className={dash.cardTitle}>{t("title")}</h3>
        <span className={dash.cardMeta}>{t("meta")}</span>
      </div>

      {payments.length === 0 ? (
        <div className={dash.histEmpty}>{t("empty")}</div>
      ) : (
        <div className={styles.payList}>
          {payments.map((payment) => {
            const isTopup = payment.type === "topup_purchase";
            const dateText = formatRuDateTime(payment.createdAt);
            const title = isTopup
              ? t("rowTopup")
              : t("rowSubscription", {
                  plan: planDisplayName,
                  month: formatRuMonth(payment.createdAt),
                });

            return (
              <div className={styles.payRow} key={payment.id}>
                <span
                  className={`${styles.payIcon} ${
                    isTopup ? styles.payIconTopup : ""
                  }`}
                >
                  {isTopup ? (
                    <PlusIcon aria-label={t("rowTopup")} />
                  ) : (
                    <RefreshIcon aria-label={title} />
                  )}
                </span>
                <div className={styles.payTx}>
                  <span className={styles.payTtl}>{title}</span>
                  {cardMask && (
                    <span className={`${styles.paySub} ${styles.paySubMask}`}>
                      {cardMask}
                    </span>
                  )}
                  <span className={`${styles.paySub} ${styles.paySubDate}`}>
                    {dateText}
                  </span>
                </div>
                <span className={styles.payAmt}>
                  {formatCurrency(
                    payment.chargedMinor,
                    currencyCode,
                    minorUnits
                  )}
                </span>
                <span className={styles.payDate}>{dateText}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
