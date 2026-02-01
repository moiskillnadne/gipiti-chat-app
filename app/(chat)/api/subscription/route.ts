import { and, eq } from "drizzle-orm";
import { auth } from "@/app/(auth)/auth";
import { getUserQuotaInfo } from "@/lib/ai/token-quota";
import { db, saveCancellationFeedback } from "@/lib/db/queries";
import { subscriptionPlan, userSubscription } from "@/lib/db/schema";
import {
  cancelSubscription,
  getSubscription,
} from "@/lib/payments/cloudpayments";
import {
  VALID_REASON_CODES,
  validateReasonCodes,
} from "@/lib/subscription/cancellation-reasons";
import { upgradeToPlan } from "@/lib/subscription/subscription-init";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription/subscription-tiers";

type CancellationFeedback = {
  reasons: string[];
  additionalFeedback?: string;
};

type CancelRequestBody = {
  feedback?: CancellationFeedback;
};

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
 * Calculate the number of days since a given date
 */
function calculateDaysSince(startDate: Date): number {
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - startDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Cancel subscription with optional feedback
 */
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  console.log("Cancelling subscription for user:", session.user.id);

  // Parse request body for feedback
  let feedback: CancellationFeedback | undefined;
  try {
    const body: CancelRequestBody = await request.json();
    feedback = body.feedback;

    // Validate reason codes if provided
    if (
      feedback?.reasons &&
      feedback.reasons.length > 0 &&
      !validateReasonCodes(feedback.reasons)
    ) {
      console.warn(
        "Invalid cancellation reason codes received:",
        feedback.reasons,
        "Valid codes:",
        VALID_REASON_CODES
      );
      // Filter to only valid codes instead of rejecting
      feedback.reasons = feedback.reasons.filter((code) =>
        VALID_REASON_CODES.includes(code as (typeof VALID_REASON_CODES)[number])
      );
    }
  } catch {
    // No body or invalid JSON - continue without feedback
    feedback = undefined;
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

    // Get plan details for feedback context
    let planName: string | undefined;
    if (subscription.planId) {
      const [plan] = await db
        .select({ name: subscriptionPlan.name })
        .from(subscriptionPlan)
        .where(eq(subscriptionPlan.id, subscription.planId))
        .limit(1);
      planName = plan?.name;
    }

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

    const now = new Date();

    // Save cancellation feedback if provided
    if (
      feedback &&
      (feedback.reasons.length > 0 || feedback.additionalFeedback)
    ) {
      try {
        const subscriptionDurationDays = calculateDaysSince(
          subscription.createdAt
        );

        await saveCancellationFeedback({
          userId: session.user.id,
          subscriptionId: subscription.id,
          reasons: feedback.reasons,
          additionalFeedback: feedback.additionalFeedback,
          planName,
          billingPeriod: subscription.billingPeriod,
          subscriptionDurationDays,
          wasTrial: subscription.isTrial,
        });

        console.log(
          "Cancellation feedback saved for user:",
          session.user.id,
          "reasons:",
          feedback.reasons
        );
      } catch (feedbackError) {
        // Log but don't fail the cancellation if feedback save fails
        console.error("Failed to save cancellation feedback:", feedbackError);
      }
    }

    if (subscription.isTrial) {
      await db
        .update(userSubscription)
        .set({
          status: "cancelled",
          cancelAtPeriodEnd: false,
          cancelledAt: now,
          isTrial: false,
          trialEndsAt: null,
        })
        .where(eq(userSubscription.id, subscription.id));

      return Response.json({
        success: true,
        message: "Trial cancelled successfully.",
      });
    }

    await db
      .update(userSubscription)
      .set({
        cancelAtPeriodEnd: true,
        cancelledAt: now,
      })
      .where(eq(userSubscription.id, subscription.id));

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
