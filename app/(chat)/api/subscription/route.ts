import { auth } from "@/app/(auth)/auth";
import { upgradeToPlan } from "@/lib/ai/subscription-init";
import { SUBSCRIPTION_TIERS } from "@/lib/ai/subscription-tiers";
import { getUserQuotaInfo } from "@/lib/ai/token-quota";

/**
 * Create or upgrade subscription
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { planName } = await request.json();

  if (!SUBSCRIPTION_TIERS[planName as keyof typeof SUBSCRIPTION_TIERS]) {
    return Response.json({ error: "Invalid plan" }, { status: 400 });
  }

  try {
    await upgradeToPlan(session.user.id, planName);

    return Response.json({
      success: true,
      message: `Successfully upgraded to ${planName}`,
    });
  } catch (error) {
    console.error("Failed to upgrade plan:", error);
    return Response.json({ error: "Failed to upgrade plan" }, { status: 500 });
  }
}

/**
 * Get current subscription
 */
export async function GET(_request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const quotaInfo = await getUserQuotaInfo(session.user.id);

  if (!quotaInfo) {
    return Response.json({ subscription: null });
  }

  return Response.json({
    subscription: quotaInfo.subscription,
    plan: quotaInfo.plan,
    quota: {
      total: quotaInfo.quota,
      used: quotaInfo.usage.totalTokens,
      remaining: quotaInfo.remaining,
      percentUsed: quotaInfo.percentUsed.toFixed(2),
    },
  });
}
