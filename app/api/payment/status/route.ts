import { and, eq } from "drizzle-orm";
import { auth } from "@/app/(auth)/auth";
import { getBalance } from "@/lib/billing/balance";
import { db } from "@/lib/db/connection";
import { paymentIntent, subscription, userSubscription } from "@/lib/db/schema";
import { checkPaymentStatusRateLimit } from "@/lib/rate-limit";
import type { PaymentStatusResponse } from "@/lib/types";

/**
 * Get payment status by session ID
 * GET /api/payment/status?sessionId=xxx
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId");

    if (!sessionId) {
      return Response.json(
        { error: "sessionId parameter is required" },
        { status: 400 }
      );
    }

    // Apply rate limiting based on IP address
    const clientIp =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const rateLimitResult = await checkPaymentStatusRateLimit(clientIp);

    if (!rateLimitResult.success) {
      return Response.json(
        {
          error: "Too many requests. Please try again later.",
          retryAfter: rateLimitResult.reset,
        },
        {
          status: 429,
          headers: {
            "Retry-After": rateLimitResult.reset
              ? Math.ceil(
                  (rateLimitResult.reset - Date.now()) / 1000
                ).toString()
              : "60",
          },
        }
      );
    }

    // Find payment intent
    const intents = await db
      .select()
      .from(paymentIntent)
      .where(
        and(
          eq(paymentIntent.sessionId, sessionId),
          eq(paymentIntent.userId, session.user.id)
        )
      )
      .limit(1);

    if (intents.length === 0) {
      return Response.json(
        { error: "Payment intent not found" },
        { status: 404 }
      );
    }

    const intent = intents[0];

    // Check if expired and update status
    if (
      intent.status === "pending" &&
      new Date(intent.expiresAt) < new Date()
    ) {
      await db
        .update(paymentIntent)
        .set({ status: "expired", updatedAt: new Date() })
        .where(eq(paymentIntent.id, intent.id));

      const response: PaymentStatusResponse = {
        status: "expired",
        hasActivity: true, // Expiration means webhook processing happened
        failureReason: "Payment intent expired after 30 minutes",
      };

      return Response.json(response);
    }

    // Determine if there was any activity on this payment intent
    // Activity means: status changed from pending OR a transaction ID was recorded
    const hasActivity =
      intent.status !== "pending" || !!intent.externalTransactionId;

    // Succeeded top-up: include the fresh balance so the success screen can
    // show the new total without an extra fetch.
    if (intent.kind === "topup" && intent.status === "succeeded") {
      const balanceSummary = await getBalance(session.user.id);

      const response: PaymentStatusResponse = {
        status: "succeeded",
        hasActivity: true,
        topup: {
          amountMinor: intent.amount,
          currencyCode: intent.currencyCode,
          balanceTotalMinor: balanceSummary?.total ?? 0,
          balanceTopupMinor: balanceSummary?.topupAmount ?? 0,
        },
      };

      return Response.json(response);
    }

    // If succeeded, fetch subscription details (join catalog for the plan code)
    if (intent.status === "succeeded" && intent.externalSubscriptionId) {
      const subscriptions = await db
        .select({
          id: userSubscription.id,
          status: userSubscription.status,
          code: subscription.code,
        })
        .from(userSubscription)
        .innerJoin(
          subscription,
          eq(userSubscription.subscriptionId, subscription.id)
        )
        .where(
          eq(
            userSubscription.externalSubscriptionId,
            intent.externalSubscriptionId
          )
        )
        .limit(1);

      if (subscriptions.length > 0) {
        const sub = subscriptions[0];
        const response: PaymentStatusResponse = {
          status: "succeeded",
          hasActivity: true,
          subscription: {
            id: sub.id,
            planName: sub.code ?? intent.metadata?.subscriptionCode ?? "",
            status: sub.status,
          },
        };

        return Response.json(response);
      }
    }

    // Return current status
    const response: PaymentStatusResponse = {
      status: intent.status as PaymentStatusResponse["status"],
      hasActivity,
      failureReason: intent.failureReason || undefined,
    };

    return Response.json(response);
  } catch (error) {
    console.error("Failed to get payment status:", error);
    return Response.json(
      { error: "Failed to get payment status" },
      { status: 500 }
    );
  }
}
