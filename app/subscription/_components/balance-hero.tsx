import Link from "next/link";
import {
  currencySymbol,
  formatCurrency,
  splitMoney,
} from "@/lib/billing/money";
import { getTranslations } from "@/lib/i18n/translate";
import type { BalanceViewState } from "@/lib/subscription/subscription-state";
import styles from "./dashboard.module.css";
import { ArrowRightIcon, InfinityIcon, RefreshIcon } from "./icons";

const MANAGE_HREF = "/manage-subscription";

const WASH_CLASS: Partial<Record<BalanceViewState, string>> = {
  free_zero: styles.heroZero,
  low: styles.heroLow,
};

export type BalanceHeroProps = {
  state: BalanceViewState;
  currencyCode: string;
  minorUnits: number;
  subscriptionAmount: number;
  topupAmount: number;
  total: number;
  subResetTag: string;
  subResetText: string;
};

export async function BalanceHero({
  state,
  currencyCode,
  minorUnits,
  subscriptionAmount,
  topupAmount,
  total,
  subResetTag,
  subResetText,
}: BalanceHeroProps) {
  const t = await getTranslations("auth.subscription.balance");
  const { sign, whole, frac } = splitMoney(total, minorUnits);
  const symbol = currencySymbol(currencyCode);
  const isZero = total === 0;

  const heroClass = [
    styles.hero,
    WASH_CLASS[state],
    isZero ? styles.balanceZero : "",
  ]
    .filter(Boolean)
    .join(" ");

  let action: string | null = null;
  if (state === "past_due") {
    action = t("heroAction.updatePayment");
  } else if (state === "cancelled") {
    action = t("heroAction.resume");
  }

  return (
    <section aria-label={t("heroLabel")} className={heroClass}>
      <div className={styles.heroWash} />
      <div className={styles.heroInner}>
        <div className={styles.heroHead}>{t("heroLabel")}</div>

        <div className={styles.balanceRow}>
          <span className={styles.balanceNum}>
            {sign}
            {whole}
          </span>
          {frac && <span className={styles.balanceFrac}>,{frac}</span>}
          <span className={styles.balanceCur}>{symbol}</span>
        </div>

        {isZero && <div className={styles.balanceSub}>{t("zeroNote")}</div>}

        <div className={styles.poolChips}>
          <div
            className={`${styles.poolChip} ${
              subscriptionAmount === 0 ? styles.poolChipEmpty : ""
            }`}
          >
            <div className={styles.chipHead}>
              <span
                className={`${styles.chipSwatch} ${styles.chipSwatchSub}`}
              />
              <span className={styles.chipLbl}>{t("pool.subscription")}</span>
              <span className={styles.chipTag}>
                <RefreshIcon />
                {subResetTag}
              </span>
            </div>
            <div className={styles.chipAmt}>
              {formatCurrency(subscriptionAmount, currencyCode, minorUnits)}
            </div>
            <div className={styles.chipSub}>{subResetText}</div>
          </div>

          <div
            className={`${styles.poolChip} ${
              topupAmount === 0 ? styles.poolChipEmpty : ""
            }`}
          >
            <div className={styles.chipHead}>
              <span
                className={`${styles.chipSwatch} ${styles.chipSwatchTop}`}
              />
              <span className={styles.chipLbl}>{t("pool.topup")}</span>
              <span className={styles.chipTag}>
                <InfinityIcon />
                {t("pool.topupTag")}
              </span>
            </div>
            <div className={styles.chipAmt}>
              {formatCurrency(topupAmount, currencyCode, minorUnits)}
            </div>
            <div className={styles.chipSub}>{t("pool.topupSub")}</div>
          </div>
        </div>

        {action && (
          <div className={styles.heroActions}>
            <Link
              className={`${styles.btn} ${styles.btnPrimary}`}
              href={MANAGE_HREF}
            >
              {action}
              <ArrowRightIcon />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
