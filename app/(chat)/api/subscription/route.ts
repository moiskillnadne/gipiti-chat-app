import { and, eq } from "drizzle-orm";
import { auth } from "@/app/(auth)/auth";
import { upgradeToPlan } from "@/lib/ai/subscription-init";
import { SUBSCRIPTION_TIERS } from "@/lib/ai/subscription-tiers";
import { getUserQuotaInfo } from "@/lib/ai/token-quota";
import { db } from "../../../../lib/db/queries";
import { user, userSubscription } from "../../../../lib/db/schema";
import { cancelSubscription } from "../../../../lib/payments/cloudpayments";

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

/**
 * Cancel subscription
 */
export async function DELETE(_request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const subscriptions = await db
      .select()
      .from(userSubscription)
      .where(
        and(
          eq(userSubscription.userId, session.user.id),
          eq(userSubscription.status, "active")
        )
      )
      .limit(1);

    if (subscriptions.length === 0) {
      return Response.json(
        { error: "No active subscription found" },
        { status: 404 }
      );
    }

    const subscription = subscriptions[0];

    if (subscription.externalSubscriptionId) {
      try {
        await cancelSubscription(subscription.externalSubscriptionId);
      } catch (error) {
        console.error("Failed to cancel CloudPayments subscription:", error);
      }
    }

    await db
      .update(userSubscription)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelAtPeriodEnd: true,
      })
      .where(eq(userSubscription.id, subscription.id));

    await db
      .update(user)
      .set({ currentPlan: "tester" })
      .where(eq(user.id, session.user.id));

    return Response.json({
      success: true,
      message: "Subscription cancelled successfully",
    });
  } catch (error) {
    console.error("Failed to cancel subscription:", error);
    return Response.json(
      { error: "Failed to cancel subscription" },
      { status: 500 }
    );
  }
}
