import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { getBalance } from "@/lib/billing/balance";
import { getMinorUnits } from "@/lib/billing/currencies";
import { formatCurrency } from "@/lib/billing/money";
import { getCardPayments } from "@/lib/billing/payment-history";
import { priceForCurrency } from "@/lib/billing/subscriptions";
import { getTranslations } from "@/lib/i18n/translate";
import {
  type BillingPeriodKey,
  getLatestSubscription,
} from "@/lib/subscription/get-latest-subscription";
import {
  type BalanceViewState,
  deriveSubscriptionUiState,
} from "@/lib/subscription/subscription-state";
import {
  formatBillingCycle,
  formatRuDate,
  formatRuDateTime,
  formatRuDayMonth,
} from "@/lib/utils/format-billing";
import dash from "../_components/dashboard.module.css";
import { CancelledBanner } from "./_components/cancelled-banner";
import styles from "./_components/manage.module.css";
import { ManageFooterStrip } from "./_components/manage-footer-strip";
import { ManageHeader } from "./_components/manage-header";
import { ManageTopNav } from "./_components/manage-top-nav";
import type {
  CancelDialogData,
  ResumeDialogData,
} from "./_components/manage-types";
import { PaymentHistoryCard } from "./_components/payment-history-card";
import { PaymentMethodCard } from "./_components/payment-method-card";
import { TariffCard } from "./_components/tariff-card";

const PRICE_SUFFIX_BY_PERIOD: Record<BillingPeriodKey, string> = {
  daily: "/день",
  weekly: "/нед",
  monthly: "/мес",
  annual: "/год",
};

export default async function ManageSubscriptionPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const [latest, balanceSummary, payments] = await Promise.all([
    getLatestSubscription(session.user.id),
    getBalance(session.user.id),
    getCardPayments({ userId: session.user.id, limit: 10 }),
  ]);

  const subscriptionRow = latest?.subscription ?? null;
  const uiState = deriveSubscriptionUiState({
    subscription: subscriptionRow,
    plan: null,
  });

  // Nothing to manage: free users, terminal rows, and cancelled subscriptions
  // whose access window already ended go back to the balance dashboard.
  if (!(latest && subscriptionRow) || uiState === "none") {
    redirect("/subscription");
  }

  const t = await getTranslations("auth.subscription.manage");
  const isCancelled = uiState === "cancelled";
  const pillState: BalanceViewState = uiState;
  const periodKey: BillingPeriodKey = latest.billingPeriod;
  const displayName = latest.displayName ?? "";

  const currencyCode =
    balanceSummary?.currencyCode ?? subscriptionRow.currencyCode;
  const minorUnits = await getMinorUnits(currencyCode);

  const planPriceMinor = await priceForCurrency(
    subscriptionRow.subscriptionId,
    currencyCode
  );
  const priceText =
    planPriceMinor == null
      ? "—"
      : formatCurrency(planPriceMinor, currencyCode, minorUnits);

  const periodStart = subscriptionRow.currentPeriodStart;
  const periodEnd = subscriptionRow.currentPeriodEnd;
  const periodEndFull = formatRuDate(periodEnd);
  const periodEndShort = formatRuDayMonth(periodEnd);
  const cycleRange = formatBillingCycle(periodStart, periodEnd);

  const nextPaymentDate = subscriptionRow.nextBillingDate
    ? formatRuDateTime(subscriptionRow.nextBillingDate)
    : formatRuDateTime(periodEnd);

  const subAmount = formatCurrency(
    balanceSummary?.subscriptionAmount ?? 0,
    currencyCode,
    minorUnits
  );
  const topupAmount = formatCurrency(
    balanceSummary?.topupAmount ?? 0,
    currencyCode,
    minorUnits
  );
  const cardMask = subscriptionRow.cardMask ?? null;

  const cancelData: CancelDialogData = {
    dateFull: periodEndFull,
    dateShort: periodEndShort,
    subAmount,
    topupAmount,
    cardMask,
  };

  const resumeData: ResumeDialogData = {
    dateFull: periodEndFull,
    priceText,
    cardMask,
  };

  return (
    <>
      <ManageTopNav state={pillState} />
      <main className={dash.body}>
        <ManageHeader
          accessUntil={periodEndFull}
          cycleRange={cycleRange}
          isCancelled={isCancelled}
        />

        {isCancelled && (
          <CancelledBanner
            dateFull={formatRuDateTime(periodEnd)}
            resumeData={resumeData}
            subAmount={subAmount}
            topupAmount={topupAmount}
          />
        )}

        <div className={dash.grid}>
          <TariffCard
            displayName={displayName}
            grantText={priceText}
            periodKey={periodKey}
            priceText={`${priceText}${PRICE_SUFFIX_BY_PERIOD[periodKey]}`}
          />

          <div className={styles.cardsRow}>
            <PaymentMethodCard
              cardMask={cardMask}
              isCancelled={isCancelled}
              nextPaymentDate={nextPaymentDate}
              priceText={priceText}
            />
            <PaymentHistoryCard
              cardMask={cardMask}
              currencyCode={currencyCode}
              minorUnits={minorUnits}
              payments={payments}
              planDisplayName={displayName}
            />
          </div>

          <ManageFooterStrip
            cancelData={cancelData}
            dateFull={periodEndFull}
            isCancelled={isCancelled}
            resumeData={resumeData}
          />

          <div className={dash.footnote}>{t("footnote")}</div>
        </div>
      </main>
    </>
  );
}
