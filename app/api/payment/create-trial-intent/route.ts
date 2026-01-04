import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db/queries";
import { paymentIntent, user } from "@/lib/db/schema";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription/subscription-tiers";
import type { PaymentIntentResponse } from "@/lib/types";

function generateSessionId(): string {
  return `ps_trial_${crypto.randomBytes(27).toString("hex")}`;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { planName } = await request.json();

    const tier =
      SUBSCRIPTION_TIERS[planName as keyof typeof SUBSCRIPTION_TIERS];
    if (!tier) {
      return Response.json(
        { error: "Invalid subscription plan" },
        { status: 400 }
      );
    }

    const [dbUser] = await db
      .select({ trialUsedAt: user.trialUsedAt })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    if (!dbUser || dbUser.trialUsedAt !== null) {
      return Response.json(
        { error: "Trial already used", code: "TRIAL_ALREADY_USED" },
        { status: 400 }
      );
    }

    const headers = request.headers;
    const clientIp = headers.get("x-forwarded-for") || headers.get("x-real-ip");
    const userAgent = headers.get("user-agent");

    const sessionId = generateSessionId();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // TODO: Check it later

    await db.insert(paymentIntent).values({
      sessionId,
      userId: session.user.id,
      planName: tier.name,
      amount: "1",
      currency: "RUB",
      status: "pending",
      isTrial: true,
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
    console.error("Failed to create trial intent:", error);
    return Response.json(
      { error: "Failed to create trial intent" },
      { status: 500 }
    );
  }
}
