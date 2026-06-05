import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { getBalance } from "@/lib/billing/balance";
import {
  EMAIL_CONFIRM_BONUS_MAJOR_UNITS,
  WELCOME_GRANT_MAJOR_UNITS,
} from "@/lib/billing/constants";
import { getMinorUnits } from "@/lib/billing/currencies";
import { formatCurrency, majorToMinorUnits } from "@/lib/billing/money";
import { getChatSpendHistory, getRecentSpendMinor } from "@/lib/billing/spend";
import { priceForCurrency } from "@/lib/billing/subscriptions";
import { db } from "@/lib/db/connection";
import { subscription, userSubscription } from "@/lib/db/schema";
import { getTranslations } from "@/lib/i18n/translate";
import {
  type BalanceViewState,
  deriveBalanceViewState,
  deriveSubscriptionUiState,
} from "@/lib/subscription/subscription-state";
import {
  daysUntil,
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
import { RewardBanner } from "./_components/reward-banner";
import { StatusBanner } from "./_components/status-banner";
import { SubscriptionHeader } from "./_components/subscription-header";
import { SubscriptionTopNav } from "./_components/subscription-top-nav";
import { TransactionHistoryCard } from "./_components/transaction-history-card";

type BillingPeriodKey = "daily" | "weekly" | "monthly" | "annual";

const PRICE_SUFFIX_BY_PERIOD: Record<BillingPeriodKey, string> = {
  daily: "/день",
  weekly: "/нед",
  monthly: "/мес",
  annual: "/год",
};

const PAID_STATES = new Set<BalanceViewState>([
  "active",
  "low",
  "trial",
  "cancelled",
  "past_due",
]);

type LatestSubscription = {
  subscription: typeof userSubscription.$inferSelect;
  displayName: string | null;
  billingPeriod: BillingPeriodKey;
};

async function getLatestSubscription(
  userId: string
): Promise<LatestSubscription | null> {
  const [row] = await db
    .select({
      subscription: userSubscription,
      displayName: subscription.displayName,
      billingPeriod: subscription.billingPeriod,
    })
    .from(userSubscription)
    .innerJoin(
      subscription,
      eq(userSubscription.subscriptionId, subscription.id)
    )
    .where(eq(userSubscription.userId, userId))
    .orderBy(desc(userSubscription.currentPeriodEnd))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    subscription: row.subscription,
    displayName: row.displayName,
    billingPeriod: row.billingPeriod as BillingPeriodKey,
  };
}

export default async function SubscriptionPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const [latest, balanceSummary, chatHistory, recentSpendMinor] =
    await Promise.all([
      getLatestSubscription(session.user.id),
      getBalance(session.user.id),
      getChatSpendHistory(session.user.id),
      getRecentSpendMinor(session.user.id),
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
  const trialEndsAt = subscriptionRow?.trialEndsAt ?? null;
  const trialDaysLeft =
    state === "trial" && trialEndsAt ? daysUntil(trialEndsAt, now) : 0;

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
  } else if (state === "trial") {
    subResetTag = trialEndsAt ? formatRuDayMonthShort(trialEndsAt) : "—";
    subResetText = t("resetText.chargesOn", {
      date: trialEndsAt ? formatRuDayMonth(trialEndsAt) : "—",
    });
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
            trialEndsAt,
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

  return (
    <>
      <SubscriptionTopNav state={state} />
      <main className={styles.body}>
        <SubscriptionHeader
          pastDueRetryIn={pastDueRetryIn}
          periodEnd={periodEnd}
          periodStart={periodStart}
          state={state}
          trialDaysLeft={trialDaysLeft}
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
          trialChargeDate={trialEndsAt ? formatRuDate(trialEndsAt) : null}
          trialCurrentPeriodEnd={periodEnd}
          trialPrice={planPriceText}
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
    trialEndsAt: Date | null;
    nextBillingDate: Date | null;
  }
): string | null {
  if (state === "cancelled") {
    return null;
  }
  if (state === "trial") {
    return dates.trialEndsAt ? formatRuDate(dates.trialEndsAt) : null;
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
