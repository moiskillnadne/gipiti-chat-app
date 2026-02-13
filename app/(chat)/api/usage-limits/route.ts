import { auth } from "@/app/(auth)/auth";
import {
  getImageGenerationCountByBillingPeriod,
  getMessageCountByBillingPeriod,
  getSearchUsageCountByBillingPeriod,
  getUserSubscriptionWithPlan,
} from "@/lib/db/queries";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription/subscription-tiers";

type UsageLimitItem = {
  used: number;
  limit: number | null;
};

type UsageLimitsResponse = {
  messages: UsageLimitItem;
  webSearch: UsageLimitItem;
  imageGeneration: UsageLimitItem;
};

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const subscriptionData = await getUserSubscriptionWithPlan({
    userId: session.user.id,
  });

  if (!subscriptionData) {
    return Response.json({ error: "No active subscription" }, { status: 404 });
  }

  const { subscription, plan } = subscriptionData;
  const tierConfig = SUBSCRIPTION_TIERS[plan.name];

  const periodStart = subscription.currentPeriodStart;
  const periodEnd = subscription.currentPeriodEnd;

  const [messagesUsed, searchUsed, imageGenUsed] = await Promise.all([
    getMessageCountByBillingPeriod({
      userId: session.user.id,
      periodStart,
      periodEnd,
    }),
    getSearchUsageCountByBillingPeriod({
      userId: session.user.id,
      periodStart,
      periodEnd,
    }),
    getImageGenerationCountByBillingPeriod({
      userId: session.user.id,
      periodStart,
      periodEnd,
    }),
  ]);

  const response: UsageLimitsResponse = {
    messages: {
      used: messagesUsed,
      limit: tierConfig?.features.maxMessagesPerPeriod ?? null,
    },
    webSearch: {
      used: searchUsed,
      limit: tierConfig?.features.searchQuota ?? null,
    },
    imageGeneration: {
      used: imageGenUsed,
      limit: tierConfig?.features.maxImageGenerationsPerPeriod ?? null,
    },
  };

  return Response.json(response);
}
