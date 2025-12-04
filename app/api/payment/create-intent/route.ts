import crypto from "node:crypto";
import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db/queries";
import { paymentIntent } from "@/lib/db/schema";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription/subscription-tiers";
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

    // Validate plan exists
    const tier =
      SUBSCRIPTION_TIERS[planName as keyof typeof SUBSCRIPTION_TIERS];
    if (!tier) {
      return Response.json(
        { error: "Invalid subscription plan" },
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

    // Create payment intent record
    await db.insert(paymentIntent).values({
      sessionId,
      userId: session.user.id,
      planName: tier.name,
      amount: tier.price.RUB.toString(),
      currency: "RUB",
      status: "pending",
      metadata: {
        planDisplayName: tier.displayName.ru,
        billingPeriod: `${tier.billingPeriodCount} ${tier.billingPeriod}`,
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
