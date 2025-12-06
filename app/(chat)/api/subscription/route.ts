import { and, eq } from "drizzle-orm";
import { auth } from "@/app/(auth)/auth";
import { getUserQuotaInfo } from "@/lib/ai/token-quota";
import { upgradeToPlan } from "@/lib/subscription/subscription-init";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription/subscription-tiers";
import { db } from "../../../../lib/db/queries";
import { userSubscription } from "../../../../lib/db/schema";
import {
  cancelSubscription,
  getSubscription,
} from "../../../../lib/payments/cloudpayments";

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

  console.log("Cancelling subscription for user:", session.user.id);

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
        const cancelResponse = await cancelSubscription(
          subscription.externalSubscriptionId
        );

        if (!cancelResponse.Success) {
          return Response.json(
            { error: "CloudPayments cancellation failed" },
            { status: 502 }
          );
        }

        const statusResponse = await getSubscription(
          subscription.externalSubscriptionId
        );

        const isCancelled =
          statusResponse.Success && statusResponse.Model.Status === "Cancelled";

        if (!isCancelled) {
          return Response.json(
            { error: "CloudPayments did not confirm cancellation" },
            { status: 502 }
          );
        }
      } catch (error) {
        console.error("Failed to cancel CloudPayments subscription:", error);
      }
    }

    await db
      .update(userSubscription)
      .set({
        cancelAtPeriodEnd: true,
        cancelledAt: new Date(),
      })
      .where(eq(userSubscription.id, subscription.id));

    // Note: currentPlan will be set to null by cron job when period ends
    // User retains access until currentPeriodEnd

    return Response.json({
      success: true,
      message: "Subscription cancelled successfully. Access until period end.",
    });
  } catch (error) {
    console.error("Failed to cancel subscription:", error);
    return Response.json(
      { error: "Failed to cancel subscription" },
      { status: 500 }
    );
  }
}
