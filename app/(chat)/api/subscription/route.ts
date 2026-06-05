import { and, eq } from "drizzle-orm";
import { auth } from "@/app/(auth)/auth";
import { getBalance } from "@/lib/billing/balance";
import { getActiveUserSubscription } from "@/lib/billing/subscriptions";
import { db } from "@/lib/db/connection";
import { saveCancellationFeedback } from "@/lib/db/query/subscription/save-cancellation-feedback";
import { subscription, userSubscription } from "@/lib/db/schema";
import {
  cancelSubscription,
  getSubscription,
} from "@/lib/payments/cloudpayments";
import {
  VALID_REASON_CODES,
  validateReasonCodes,
} from "@/lib/subscription/cancellation-reasons";
import { upgradeToPlan } from "@/lib/subscription/subscription-init";

type CancellationFeedback = {
  reasons: string[];
  additionalFeedback?: string;
};

type CancelRequestBody = {
  feedback?: CancellationFeedback;
};

type UpgradeRequestBody = {
  code?: string;
  planName?: string;
};

/**
 * Create or upgrade subscription
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body: UpgradeRequestBody = await request.json();
  const code = body.code ?? body.planName;

  if (!code) {
    return Response.json(
      { error: "Missing subscription code" },
      { status: 400 }
    );
  }

  try {
    await upgradeToPlan(session.user.id, code);

    return Response.json({
      success: true,
      message: `Successfully upgraded to ${code}`,
    });
  } catch (error) {
    console.error("Failed to upgrade plan:", error);
    return Response.json({ error: "Failed to upgrade plan" }, { status: 500 });
  }
}

/**
 * Get current subscription and balance
 */
export async function GET(_request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [subscriptionRow, balanceSummary] = await Promise.all([
    getActiveUserSubscription(session.user.id),
    getBalance(session.user.id),
  ]);

  return Response.json({
    subscription: subscriptionRow,
    balance: balanceSummary,
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

    const activeSubscription = subscriptions[0];

    // Resolve catalog metadata (code + billing period) for feedback context.
    const [catalogEntry] = await db
      .select({
        code: subscription.code,
        billingPeriod: subscription.billingPeriod,
      })
      .from(subscription)
      .where(eq(subscription.id, activeSubscription.subscriptionId))
      .limit(1);

    if (activeSubscription.externalSubscriptionId) {
      try {
        const cancelResponse = await cancelSubscription(
          activeSubscription.externalSubscriptionId
        );

        if (!cancelResponse.Success) {
          return Response.json(
            { error: "CloudPayments cancellation failed" },
            { status: 502 }
          );
        }

        const statusResponse = await getSubscription(
          activeSubscription.externalSubscriptionId
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
          activeSubscription.createdAt
        );

        await saveCancellationFeedback({
          userId: session.user.id,
          subscriptionId: activeSubscription.id,
          reasons: feedback.reasons,
          additionalFeedback: feedback.additionalFeedback,
          planName: catalogEntry?.code,
          billingPeriod: catalogEntry?.billingPeriod,
          subscriptionDurationDays,
          wasTrial: activeSubscription.isTrial,
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

    if (activeSubscription.isTrial) {
      await db
        .update(userSubscription)
        .set({
          status: "cancelled",
          cancelAtPeriodEnd: false,
          cancelledAt: now,
          isTrial: false,
          trialEndsAt: null,
        })
        .where(eq(userSubscription.id, activeSubscription.id));

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
      .where(eq(userSubscription.id, activeSubscription.id));

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
