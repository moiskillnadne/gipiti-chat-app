import { and, eq } from "drizzle-orm";
import { auth } from "@/app/(auth)/auth";
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

type CancellationFeedback = {
  reasons: string[];
  additionalFeedback?: string;
};

type CancelRequestBody = {
  feedback?: CancellationFeedback;
};

/** Same error code as `subscription/resume` returns for a provider failure. */
const PAYMENT_PROVIDER_ERROR = "payment_provider_error";

// There is deliberately no POST handler here. A subscription becomes active only
// through the CloudPayments `pay` webhook, after a payment (GIPITI-119).

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
        // The provider did not answer, so nobody knows whether it will keep
        // charging. Marking the subscription cancelled here would tell the
        // user it is over while the card may still be billed: stop, change
        // nothing locally, and let the user try again.
        console.error("Failed to cancel CloudPayments subscription:", error);
        return Response.json(
          { error: PAYMENT_PROVIDER_ERROR },
          { status: 502 }
        );
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
