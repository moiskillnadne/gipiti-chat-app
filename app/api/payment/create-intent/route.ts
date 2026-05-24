import crypto from "node:crypto";
import { auth } from "@/app/(auth)/auth";
import { DEFAULT_CURRENCY_CODE } from "@/lib/billing/constants";
import {
  getSubscriptionByCode,
  priceForCurrency,
} from "@/lib/billing/subscriptions";
import { db } from "@/lib/db/connection";
import { paymentIntent } from "@/lib/db/schema";
import type { PaymentIntentResponse } from "@/lib/types";

/**
 * Generate a unique session ID for payment intent
 */
function generateSessionId(): string {
  return `ps_${crypto.randomBytes(28).toString("hex")}`;
}

/**
 * Create a payment intent for tracking payment lifecycle
 * POST /api/payment/create-intent
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { planName } = await request.json();

    // Resolve the subscription catalog entry by its stable code.
    const sub = await getSubscriptionByCode(planName);
    if (!sub || !sub.isActive) {
      return Response.json(
        { error: "Invalid subscription plan" },
        { status: 400 }
      );
    }

    const price = await priceForCurrency(sub.id, DEFAULT_CURRENCY_CODE);
    if (price == null) {
      return Response.json(
        { error: "No price configured for subscription" },
        { status: 400 }
      );
    }

    // Get client info for metadata
    const headers = request.headers;
    const clientIp = headers.get("x-forwarded-for") || headers.get("x-real-ip");
    const userAgent = headers.get("user-agent");

    // Generate unique session ID
    const sessionId = generateSessionId();

    // Set expiration to 30 minutes from now
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    // Create payment intent record (amount stored in minor units of RUB)
    await db.insert(paymentIntent).values({
      sessionId,
      userId: session.user.id,
      kind: "subscription",
      subscriptionId: sub.id,
      currencyCode: DEFAULT_CURRENCY_CODE,
      amount: price,
      status: "pending",
      metadata: {
        subscriptionCode: sub.code,
        billingPeriod: `${sub.billingPeriodCount} ${sub.billingPeriod}`,
        clientIp: clientIp || undefined,
        userAgent: userAgent || undefined,
      },
      expiresAt,
    });

    const response: PaymentIntentResponse = {
      sessionId,
      expiresAt: expiresAt.toISOString(),
    };

    return Response.json(response);
  } catch (error) {
    console.error("Failed to create payment intent:", error);
    return Response.json(
      { error: "Failed to create payment intent" },
      { status: 500 }
    );
  }
}
