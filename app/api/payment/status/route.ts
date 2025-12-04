import { and, eq } from "drizzle-orm";
import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db/queries";
import { paymentIntent, userSubscription } from "@/lib/db/schema";
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
        failureReason: "Payment intent expired after 30 minutes",
      };

      return Response.json(response);
    }

    // If succeeded, fetch subscription details
    if (intent.status === "succeeded" && intent.externalSubscriptionId) {
      const subscriptions = await db
        .select()
        .from(userSubscription)
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
          subscription: {
            id: sub.id,
            planName: intent.planName,
            status: sub.status,
          },
        };

        return Response.json(response);
      }
    }

    // Return current status
    const response: PaymentStatusResponse = {
      status: intent.status as PaymentStatusResponse["status"],
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
