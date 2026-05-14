import { auth } from "@/app/(auth)/auth";
import { getDefaultFreePlanSeed } from "@/lib/ai/entitlements";
import { getBalanceRecord } from "@/lib/ai/token-balance";
import {
  getImageGenerationCountByBillingPeriod,
  getImageGenerationCountByDateRange,
  getSearchUsageCountByBillingPeriod,
  getSearchUsageCountByDateRange,
  getUserSubscriptionWithPlan,
  getVideoGenerationCountByBillingPeriod,
  getVideoGenerationCountByDateRange,
} from "@/lib/db/queries";
import { getMessageCountByBillingPeriod } from "@/lib/db/query/chat/get-message-count-by-billing-period";
import { getUserById } from "@/lib/db/query/user/get-by-id";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription/subscription-tiers";

type UsageLimitItem = {
  used: number;
  limit: number | null;
};

type UsageLimitsResponse = {
  messages: UsageLimitItem;
  webSearch: UsageLimitItem;
  imageGeneration: UsageLimitItem;
  videoGeneration: UsageLimitItem;
};

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const subscriptionData = await getUserSubscriptionWithPlan({
    userId: session.user.id,
  });

  // Free users have no `userSubscription` row. Synthesize the response from
  // the free-plan seed + lifetime usage counts (counted since user creation).
  if (!subscriptionData) {
    const userRecord = await getUserById(session.user.id);
    const balanceRow = await getBalanceRecord(session.user.id);
    if (!userRecord || balanceRow?.plan !== "free") {
      return Response.json(
        { error: "No active subscription" },
        { status: 404 }
      );
    }

    const seed = getDefaultFreePlanSeed();
    const start = userRecord.createdAt;
    const end = new Date();
    const [freeSearchUsed, freeImageGenUsed, freeVideoGenUsed] =
      await Promise.all([
        getSearchUsageCountByDateRange({
          userId: session.user.id,
          startDate: start,
          endDate: end,
        }),
        getImageGenerationCountByDateRange({
          userId: session.user.id,
          startDate: start,
          endDate: end,
        }),
        getVideoGenerationCountByDateRange({
          userId: session.user.id,
          startDate: start,
          endDate: end,
        }),
      ]);

    const freeResponse: UsageLimitsResponse = {
      messages: {
        used: 0,
        limit: seed.features.maxMessagesPerPeriod ?? null,
      },
      webSearch: {
        used: freeSearchUsed,
        limit: seed.features.searchQuota,
      },
      imageGeneration: {
        used: freeImageGenUsed,
        limit: seed.features.maxImageGenerationsPerPeriod,
      },
      videoGeneration: {
        used: freeVideoGenUsed,
        limit: seed.features.maxVideoGenerationsPerPeriod,
      },
    };

    return Response.json(freeResponse);
  }

  const { subscription, plan } = subscriptionData;
  const tierConfig = SUBSCRIPTION_TIERS[plan.name];

  const periodStart = subscription.currentPeriodStart;
  const periodEnd = subscription.currentPeriodEnd;

  const [messagesUsed, searchUsed, imageGenUsed, videoGenUsed] =
    await Promise.all([
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
      getVideoGenerationCountByBillingPeriod({
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
    videoGeneration: {
      used: videoGenUsed,
      limit: tierConfig?.features.maxVideoGenerationsPerPeriod ?? null,
    },
  };

  return Response.json(response);
}
