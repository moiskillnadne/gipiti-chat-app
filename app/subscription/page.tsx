import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import {
  FREE_TIER_ENTITLEMENTS,
  getDefaultFreePlanSeed,
} from "@/lib/ai/entitlements";
import { getBalanceRecord } from "@/lib/ai/token-balance";
import { getLatestUserSubscriptionWithPlan } from "@/lib/db/query/subscription/get-latest-user-subscription-with-plan";
import { getTranslations } from "@/lib/i18n/translate";
import {
  deriveSubscriptionUiState,
  type SubscriptionUiState,
} from "@/lib/subscription/subscription-state";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription/subscription-tiers";
import {
  daysUntil,
  formatRelativeRu,
  formatRuDate,
  formatRuDayTime,
} from "@/lib/utils/format-billing";
import { DangerZoneStrip } from "./_components/danger-zone-strip";
import styles from "./_components/dashboard.module.css";
import { FreePlanCard } from "./_components/free-plan-card";
import {
  type FreeLimitBonus,
  PeriodLimitsCard,
} from "./_components/period-limits-card";
import { PlanCard, type PlanCardData } from "./_components/plan-card";
import { StatusBanner } from "./_components/status-banner";
import { SubscriptionHeader } from "./_components/subscription-header";
import { SubscriptionTopNav } from "./_components/subscription-top-nav";
import {
  type FreeUsageData,
  UsageGaugeCard,
} from "./_components/usage-gauge-card";

type BillingPeriodKey = "daily" | "weekly" | "monthly" | "annual";

const PRICE_SUFFIX_BY_PERIOD: Record<BillingPeriodKey, string> = {
  daily: "/день",
  weekly: "/нед",
  monthly: "/мес",
  annual: "/год",
};

const PERIOD_LABEL_KEY_BY_PERIOD: Record<BillingPeriodKey, string> = {
  daily: "daily",
  weekly: "weekly",
  monthly: "monthly",
  annual: "annual",
};

function formatRubles(amount: number): string {
  return amount.toLocaleString("ru-RU");
}

function priceForPlan(planName: string, fallback: number): number {
  return SUBSCRIPTION_TIERS[planName]?.price.RUB ?? fallback;
}

export default async function SubscriptionPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const subscriptionData = await getLatestUserSubscriptionWithPlan({
    userId: session.user.id,
  });

  const subscription = subscriptionData?.subscription ?? null;
  const plan = subscriptionData?.plan ?? null;
  const state: SubscriptionUiState = deriveSubscriptionUiState({
    subscription,
    plan,
  });

  const tPlan = await getTranslations("auth.subscription.dashboard.plan");
  const periodKey: BillingPeriodKey =
    (plan?.billingPeriod as BillingPeriodKey | undefined) ?? "monthly";
  const periodLabel = tPlan(
    `billingPeriod.${PERIOD_LABEL_KEY_BY_PERIOD[periodKey]}`
  );

  const now = new Date();
  const trialDaysLeft =
    state === "trial" && subscription?.trialEndsAt
      ? daysUntil(subscription.trialEndsAt, now)
      : 0;

  const planRubPrice = plan
    ? priceForPlan(plan.name, Number(plan.price ?? 0))
    : 0;
  const formattedPrice = `${formatRubles(planRubPrice)} ₽ ${PRICE_SUFFIX_BY_PERIOD[periodKey]}`;

  const lastPaymentText =
    subscription?.lastPaymentDate && subscription.lastPaymentAmount
      ? `${formatRuDate(subscription.lastPaymentDate)} · ${formatRubles(Number(subscription.lastPaymentAmount))} ₽`
      : null;

  const planCardData: PlanCardData | null =
    state === "none" || !plan
      ? null
      : {
          displayName: plan.displayName ?? plan.name,
          periodLabel,
          formattedPrice,
          nextPaymentDate: subscription?.nextBillingDate
            ? formatRuDate(subscription.nextBillingDate)
            : null,
          lastPayment: lastPaymentText,
          cardMask: subscription?.cardMask ?? null,
          accessUntilDate: subscription?.currentPeriodEnd
            ? formatRuDate(subscription.currentPeriodEnd)
            : null,
          chargingStartDate: subscription?.trialEndsAt
            ? formatRuDate(subscription.trialEndsAt)
            : null,
          nextRetryDate: subscription?.nextBillingDate
            ? state === "past_due"
              ? formatRuDayTime(subscription.nextBillingDate, now)
              : formatRuDate(subscription.nextBillingDate)
            : null,
          pastDueLastAmount: subscription?.lastPaymentAmount
            ? `${formatRubles(Number(subscription.lastPaymentAmount))} ₽`
            : null,
        };

  const pastDueRetryIn =
    state === "past_due" && subscription?.nextBillingDate
      ? formatRelativeRu(subscription.nextBillingDate, now)
      : null;

  const emailVerified = session.user.emailVerified === true;
  let freeUsage: FreeUsageData | null = null;
  let freeBonuses: FreeLimitBonus | null = null;
  let rewardAmountK = 0;

  if (state === "none") {
    const seed = getDefaultFreePlanSeed();
    const balanceRow = await getBalanceRecord(session.user.id);
    const quota = seed.tokenQuota;
    const tokenBalance = balanceRow ? Number(balanceRow.tokens) || 0 : 0;
    const spent = Math.max(0, quota - tokenBalance);
    const remaining = Math.max(0, tokenBalance);

    const tier1 = FREE_TIER_ENTITLEMENTS.tier_1;
    const tier3 = FREE_TIER_ENTITLEMENTS.tier_3;
    const tokenDeltaK = Math.max(
      0,
      Math.round((tier3.tokenBonus - tier1.tokenBonus) / 1000)
    );
    rewardAmountK = tokenDeltaK;

    freeUsage = {
      quota,
      spent,
      remaining,
      quotaBonusK: emailVerified ? null : tokenDeltaK || null,
    };

    if (!emailVerified) {
      const imageDelta = Math.max(0, tier3.imageBonus - tier1.imageBonus);
      const videoDelta = Math.max(0, tier3.videoBonus - tier1.videoBonus);
      const searchDelta = Math.max(0, tier3.searchQuota - tier1.searchQuota);
      freeBonuses = {
        webSearch: searchDelta > 0 ? searchDelta : null,
        imageGeneration: imageDelta > 0 ? imageDelta : null,
        videoGeneration: videoDelta > 0 ? "static" : null,
      };
    }
  }

  const dimmedCards = state === "cancelled" || state === "past_due";

  return (
    <>
      <SubscriptionTopNav state={state} />
      <main className={styles.body}>
        <SubscriptionHeader
          periodEnd={subscription?.currentPeriodEnd ?? null}
          periodStart={subscription?.currentPeriodStart ?? null}
          state={state}
          trialDaysLeft={trialDaysLeft}
        />

        <StatusBanner
          cancelCurrentPeriodEnd={subscription?.currentPeriodEnd ?? null}
          cancelEndDate={subscription?.currentPeriodEnd ?? null}
          pastDueCardMask={subscription?.cardMask ?? null}
          pastDuePriceLabel={formattedPrice}
          pastDueRetryIn={pastDueRetryIn}
          state={state}
          trialChargingStartDate={subscription?.trialEndsAt ?? null}
          trialDaysLeft={trialDaysLeft}
          trialPlanName={plan?.displayName ?? plan?.name ?? ""}
          trialPriceLabel={formattedPrice}
        />

        <div className={styles.grid}>
          <UsageGaugeCard
            dimmed={dimmedCards}
            freeUsage={freeUsage}
            state={state}
          />

          {state === "none" ? (
            <FreePlanCard
              email={session.user.email ?? ""}
              emailVerified={emailVerified}
              rewardAmountK={rewardAmountK}
            />
          ) : (
            planCardData && (
              <PlanCard
                data={planCardData}
                dimmed={dimmedCards}
                state={state}
              />
            )
          )}

          <PeriodLimitsCard
            dimmed={dimmedCards}
            freeBonuses={freeBonuses}
            state={state}
          />

          {state === "active" && subscription?.currentPeriodEnd && (
            <DangerZoneStrip currentPeriodEnd={subscription.currentPeriodEnd} />
          )}
        </div>
      </main>
    </>
  );
}
