import Link from "next/link";
import { isTopupEnabled } from "@/lib/flags";
import { getTranslations } from "@/lib/i18n/translate";
import type { BalanceViewState } from "@/lib/subscription/subscription-state";
import { cn } from "../../../lib/utils";
import styles from "./dashboard.module.css";
import { CardIcon } from "./icons";
import { TopUpButton } from "./top-up-button";

const MANAGE_HREF = "/manage-subscription";

export type PlanCardData = {
  displayName: string;
  planTag: string;
  formattedPrice: string;
  nextPaymentLabel: string;
  nextPaymentDate: string | null;
  nextPaymentAmount: string | null;
  cardMask: string | null;
};

type PlanCardProps = {
  data: PlanCardData;
  state: BalanceViewState;
  dimmed?: boolean;
};

export async function PlanCard({ data, state, dimmed = false }: PlanCardProps) {
  const [t, showTopup] = await Promise.all([
    getTranslations("auth.subscription.balance.plan"),
    isTopupEnabled(),
  ]);
  const cardClass = [styles.card, dimmed ? styles.cardDimmed : ""]
    .filter(Boolean)
    .join(" ");
  const metaLabel = t("metaActive");

  return (
    <section aria-label={t("title")} className={cardClass}>
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>{t("title")}</h3>
        <span className={styles.cardMeta}>{metaLabel}</span>
      </div>

      <div className={styles.planRow}>
        <span className={styles.planNm}>
          {data.displayName}
          <span className={styles.planNmEm}>{data.planTag}</span>
        </span>
        <span className={styles.planPr}>
          {t("priceLabel")}
          <b>{data.formattedPrice}</b>
        </span>
      </div>

      <div className={styles.planKvList}>
        {data.nextPaymentDate && (
          <div className={styles.planKv}>
            <span className={styles.planKvK}>{data.nextPaymentLabel}</span>
            <span className={styles.planKvV}>
              {data.nextPaymentDate}
              {data.nextPaymentAmount && (
                <>
                  {" · "}
                  <span className={styles.planKvVMono}>
                    {data.nextPaymentAmount}
                  </span>
                </>
              )}
            </span>
          </div>
        )}
        {data.cardMask && (
          <div className={cn(styles.planKv, styles.cardMask)}>
            <span className={styles.planKvK}>{t("paymentMethod")}</span>
            <span className={`${styles.planKvV} ${styles.planKvVMono}`}>
              <CardIcon height={12} width={12} /> {data.cardMask}
            </span>
          </div>
        )}
      </div>

      <div className={styles.planActions}>
        {showTopup && <TopUpButton state={state} />}
        <Link
          className={`${styles.btn} ${styles.btnOutline} ${styles.btnSm}`}
          href={MANAGE_HREF}
        >
          {t("manage")}
        </Link>
      </div>
    </section>
  );
}
