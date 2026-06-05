import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { auth } from "@/app/(auth)/auth";
import { DEFAULT_CURRENCY_CODE } from "@/lib/billing/constants";
import { majorToMinorUnits } from "@/lib/billing/money";
import { getSubscriptionByCode } from "@/lib/billing/subscriptions";
import { db } from "@/lib/db/connection";
import { paymentIntent, user } from "@/lib/db/schema";
import type { PaymentIntentResponse } from "@/lib/types";

// The schema's metadata column type is closed; widen it locally to carry the
// trial flag (the column accepts any structurally-compatible object).
type PaymentIntentMetadata = NonNullable<
  (typeof paymentIntent.$inferInsert)["metadata"]
> & {
  isTrial?: boolean;
};

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

    const sub = await getSubscriptionByCode(planName);
    if (!sub || !sub.isActive) {
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
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const metadata: PaymentIntentMetadata = {
      subscriptionCode: sub.code,
      billingPeriod: `${sub.billingPeriodCount} ${sub.billingPeriod}`,
      isTrial: true,
      clientIp: clientIp || undefined,
      userAgent: userAgent || undefined,
    };

    // Trial places a 1 RUB hold; the trial flag lives in metadata, not a column.
    await db.insert(paymentIntent).values({
      sessionId,
      userId: session.user.id,
      kind: "subscription",
      subscriptionId: sub.id,
      currencyCode: DEFAULT_CURRENCY_CODE,
      amount: majorToMinorUnits(1, 2),
      status: "pending",
      metadata,
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
