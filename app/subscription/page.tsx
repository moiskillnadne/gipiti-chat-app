import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { getLatestUserSubscriptionWithPlan } from "@/lib/db/queries";
import { getTranslations } from "@/lib/i18n/translate";
import {
  deriveSubscriptionUiState,
  type SubscriptionUiState,
} from "@/lib/subscription/subscription-state";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription/subscription-tiers";
import { daysUntil, formatRuDate } from "@/lib/utils/format-billing";
import { DangerZoneStrip } from "./_components/danger-zone-strip";
import styles from "./_components/dashboard.module.css";
import { FreeQuotaStrip } from "./_components/free-quota-strip";
import { PeriodLimitsCard } from "./_components/period-limits-card";
import { PlanCard, type PlanCardData } from "./_components/plan-card";
import { PlansGridCard } from "./_components/plans-grid-card";
import { StatusBanner } from "./_components/status-banner";
import { SubscriptionHeader } from "./_components/subscription-header";
import { SubscriptionTopNav } from "./_components/subscription-top-nav";
import { UsageGaugeCard } from "./_components/usage-gauge-card";

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
            ? formatRuDate(subscription.nextBillingDate)
            : null,
          pastDueLastAmount: subscription?.lastPaymentAmount
            ? `${formatRubles(Number(subscription.lastPaymentAmount))} ₽`
            : null,
        };

  const dimmedCards = state === "cancelled" || state === "past_due";
  const showFullSubUI = state !== "none";

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
          state={state}
          trialChargingStartDate={subscription?.trialEndsAt ?? null}
          trialDaysLeft={trialDaysLeft}
          trialPlanName={plan?.displayName ?? plan?.name ?? ""}
          trialPriceLabel={formattedPrice}
        />

        {state === "none" && <FreeQuotaStrip />}

        {showFullSubUI ? (
          <div className={styles.grid}>
            <UsageGaugeCard dimmed={dimmedCards} state={state} />

            {planCardData && (
              <PlanCard
                data={planCardData}
                dimmed={dimmedCards}
                state={state}
              />
            )}

            <PeriodLimitsCard dimmed={dimmedCards} />

            {state === "active" && subscription?.currentPeriodEnd && (
              <DangerZoneStrip
                currentPeriodEnd={subscription.currentPeriodEnd}
              />
            )}
          </div>
        ) : (
          <PlansGridCard />
        )}
      </main>
    </>
  );
}
