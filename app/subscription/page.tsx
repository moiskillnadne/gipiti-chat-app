import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { getBalance } from "@/lib/billing/balance";
import {
  EMAIL_CONFIRM_BONUS_MAJOR_UNITS,
  ONBOARDING_QUIZ_BONUS_MAJOR_UNITS,
  WELCOME_GRANT_MAJOR_UNITS,
} from "@/lib/billing/constants";
import { getMinorUnits } from "@/lib/billing/currencies";
import { formatCurrency, majorToMinorUnits } from "@/lib/billing/money";
import { getChatSpendHistory, getRecentSpendMinor } from "@/lib/billing/spend";
import { priceForCurrency } from "@/lib/billing/subscriptions";
import { getQuizResponse } from "@/lib/db/query/quiz/get-quiz-response";
import { getTranslations } from "@/lib/i18n/translate";
import { ONBOARDING_QUIZ_KEY } from "@/lib/quiz/types";
import {
  type BillingPeriodKey,
  getLatestSubscription,
} from "@/lib/subscription/get-latest-subscription";
import {
  type BalanceViewState,
  deriveBalanceViewState,
  deriveSubscriptionUiState,
} from "@/lib/subscription/subscription-state";
import {
  formatRelativeRu,
  formatRuDate,
  formatRuDayMonth,
  formatRuDayMonthShort,
  formatRuDayTime,
} from "@/lib/utils/format-billing";
import { BalanceHero } from "./_components/balance-hero";
import styles from "./_components/dashboard.module.css";
import { FreeSideCard } from "./_components/free-side-card";
import { PlanCard, type PlanCardData } from "./_components/plan-card";
import { QuizRewardBanner } from "./_components/quiz-reward-banner";
import { RewardBanner } from "./_components/reward-banner";
import { StatusBanner } from "./_components/status-banner";
import { SubscriptionHeader } from "./_components/subscription-header";
import { SubscriptionTopNav } from "./_components/subscription-top-nav";
import { TransactionHistoryCard } from "./_components/transaction-history-card";

const PRICE_SUFFIX_BY_PERIOD: Record<BillingPeriodKey, string> = {
  daily: "/день",
  weekly: "/нед",
  monthly: "/мес",
  annual: "/год",
};

const PAID_STATES = new Set<BalanceViewState>([
  "active",
  "low",
  "cancelled",
  "past_due",
]);

export default async function SubscriptionPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const [
    latest,
    balanceSummary,
    chatHistory,
    recentSpendMinor,
    onboardingQuizResponse,
  ] = await Promise.all([
    getLatestSubscription(session.user.id),
    getBalance(session.user.id),
    getChatSpendHistory(session.user.id),
    getRecentSpendMinor(session.user.id),
    getQuizResponse({
      userId: session.user.id,
      quizKey: ONBOARDING_QUIZ_KEY,
    }),
  ]);

  const t = await getTranslations("auth.subscription.balance");
  const now = new Date();
  const subscriptionRow = latest?.subscription ?? null;
  const periodKey: BillingPeriodKey = latest?.billingPeriod ?? "monthly";

  const currencyCode = balanceSummary?.currencyCode ?? "RUB";
  const minorUnits = balanceSummary ? await getMinorUnits(currencyCode) : 2;
  const subscriptionAmount = balanceSummary?.subscriptionAmount ?? 0;
  const topupAmount = balanceSummary?.topupAmount ?? 0;
  const total = balanceSummary?.total ?? 0;

  const uiState = deriveSubscriptionUiState({
    subscription: subscriptionRow,
    plan: null,
  });
  const state = deriveBalanceViewState({ uiState, balanceTotal: total });
  const isFree = !PAID_STATES.has(state);

  const periodStart = subscriptionRow?.currentPeriodStart ?? null;
  const periodEnd = subscriptionRow?.currentPeriodEnd ?? null;

  const planPriceMinor = subscriptionRow
    ? await priceForCurrency(subscriptionRow.subscriptionId, currencyCode)
    : null;
  const planPriceText =
    planPriceMinor == null
      ? "—"
      : formatCurrency(planPriceMinor, currencyCode, minorUnits);
  const pastDueRetryIn =
    state === "past_due" && subscriptionRow?.nextBillingDate
      ? formatRelativeRu(subscriptionRow.nextBillingDate, now)
      : null;

  // Hero pool reset tag + caption, per state.
  let subResetTag = "—";
  let subResetText = t("resetText.noSub");
  if (state === "active" || state === "low") {
    subResetTag = periodEnd ? formatRuDayMonthShort(periodEnd) : "—";
    subResetText = t("resetText.onRenewal");
  } else if (state === "cancelled") {
    subResetTag = periodEnd ? formatRuDayMonthShort(periodEnd) : "—";
    subResetText = t("resetText.burnsOn", {
      date: periodEnd ? formatRuDayMonth(periodEnd) : "—",
    });
  } else if (state === "past_due") {
    subResetTag = t("resetText.pausedTag");
    subResetText = t("resetText.nothing");
  }

  const planCardData: PlanCardData | null =
    isFree || !subscriptionRow
      ? null
      : {
          displayName: latest?.displayName ?? "",
          planTag: t(`plan.period.${periodKey}`),
          formattedPrice: `${planPriceText}${PRICE_SUFFIX_BY_PERIOD[periodKey]}`,
          nextPaymentLabel:
            state === "past_due" ? t("plan.nextRetry") : t("plan.nextPayment"),
          nextPaymentDate: resolveNextPaymentDate(state, {
            now,
            periodEnd,
            nextBillingDate: subscriptionRow.nextBillingDate ?? null,
          }),
          nextPaymentAmount:
            state === "past_due" || planPriceMinor == null
              ? null
              : planPriceText,
          cardMask: subscriptionRow.cardMask ?? null,
        };

  const welcomeAmount = formatCurrency(
    majorToMinorUnits(WELCOME_GRANT_MAJOR_UNITS, minorUnits),
    currencyCode,
    minorUnits
  );
  const dimmed = state === "cancelled" || state === "past_due";

  // Reward banner: invites users who have not confirmed their email to do so
  // in exchange for a one-time bonus. Hidden once the email is verified.
  const userEmail = session.user.email ?? null;
  const showRewardBanner = !session.user.emailVerified && userEmail !== null;
  const emailBonusAmount = formatCurrency(
    majorToMinorUnits(EMAIL_CONFIRM_BONUS_MAJOR_UNITS, minorUnits),
    currencyCode,
    minorUnits
  );

  // Quiz banner: once the email is verified, invite the user to complete the
  // onboarding quiz for a one-time bonus. Mutually exclusive with the email
  // banner; hidden once the quiz is completed.
  const showQuizBanner =
    session.user.emailVerified && onboardingQuizResponse === null;
  const quizBonusAmount = formatCurrency(
    majorToMinorUnits(ONBOARDING_QUIZ_BONUS_MAJOR_UNITS, minorUnits),
    currencyCode,
    minorUnits
  );

  return (
    <>
      <SubscriptionTopNav state={state} />
      <main className={styles.body}>
        <SubscriptionHeader
          pastDueRetryIn={pastDueRetryIn}
          periodEnd={periodEnd}
          periodStart={periodStart}
          state={state}
        />

        <StatusBanner
          cancelledDate={periodEnd ? formatRuDate(periodEnd) : null}
          cancelledSubAmount={formatCurrency(
            subscriptionAmount,
            currencyCode,
            minorUnits
          )}
          cancelledTopupAmount={formatCurrency(
            topupAmount,
            currencyCode,
            minorUnits
          )}
          pastDueCardMask={subscriptionRow?.cardMask ?? null}
          pastDuePrice={planPriceText}
          pastDueRetryIn={pastDueRetryIn}
          state={state}
        />

        <div className={styles.grid}>
          <div className={styles.row}>
            <BalanceHero
              currencyCode={currencyCode}
              minorUnits={minorUnits}
              state={state}
              subResetTag={subResetTag}
              subResetText={subResetText}
              subscriptionAmount={subscriptionAmount}
              topupAmount={topupAmount}
              total={total}
            />

            {isFree || !planCardData ? (
              <FreeSideCard welcomeAmount={welcomeAmount} />
            ) : (
              <PlanCard data={planCardData} dimmed={dimmed} state={state} />
            )}
          </div>

          {showRewardBanner && userEmail ? (
            <RewardBanner bonusAmount={emailBonusAmount} email={userEmail} />
          ) : null}

          {showQuizBanner ? (
            <QuizRewardBanner bonusAmount={quizBonusAmount} />
          ) : null}

          <TransactionHistoryCard
            chats={chatHistory}
            currencyCode={currencyCode}
            minorUnits={minorUnits}
            recentSpendMinor={recentSpendMinor}
          />

          <div className={styles.footnote}>{t("footnote")}</div>
        </div>
      </main>
    </>
  );
}

function resolveNextPaymentDate(
  state: BalanceViewState,
  dates: {
    now: Date;
    periodEnd: Date | null;
    nextBillingDate: Date | null;
  }
): string | null {
  if (state === "cancelled") {
    return null;
  }
  if (state === "past_due") {
    return dates.nextBillingDate
      ? formatRuDayTime(dates.nextBillingDate, dates.now)
      : null;
  }
  if (dates.nextBillingDate) {
    return formatRuDate(dates.nextBillingDate);
  }
  return dates.periodEnd ? formatRuDate(dates.periodEnd) : null;
}
