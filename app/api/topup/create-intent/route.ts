import crypto from "node:crypto";
import { auth } from "@/app/(auth)/auth";
import { ensureBalance } from "@/lib/billing/balance";
import {
  DEFAULT_CURRENCY_CODE,
  TOPUP_MIN_MAJOR_UNITS,
  TOPUP_TESTER_MIN_MAJOR_UNITS,
} from "@/lib/billing/constants";
import { majorToMinorUnits } from "@/lib/billing/money";
import { db } from "@/lib/db/connection";
import { getUserById } from "@/lib/db/query/user/get-by-id";
import { paymentIntent } from "@/lib/db/schema";
import { isTopupEnabled } from "@/lib/flags";
import { getLatestSubscription } from "@/lib/subscription/get-latest-subscription";
import { deriveSubscriptionUiState } from "@/lib/subscription/subscription-state";
import type { TopupIntentResponse } from "@/lib/types";
import { createTopupIntentRequestSchema } from "@/lib/validation/topup";

const RUB_MINOR_UNITS = 2;
const INTENT_TTL_MS = 30 * 60 * 1000;

/**
 * The `tu_` prefix distinguishes top-up sessions from subscription `ps_` ones.
 */
function generateSessionId(): string {
  return `tu_${crypto.randomBytes(28).toString("hex")}`;
}

/**
 * Create a payment intent for a one-time balance top-up.
 * POST /api/topup/create-intent
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Mirrors the dashboard button: while the rollout flag is off for this
  // user, the endpoint does not exist for them.
  if (!(await isTopupEnabled())) {
    return Response.json({ error: "Top-up is not available" }, { status: 403 });
  }

  try {
    // Fresh DB read — the session JWT copy of isTester is login-time and can
    // be stale. Testers get a lowered minimum to verify the flow cheaply.
    const userRecord = await getUserById(session.user.id);
    const minAmountMajor = userRecord?.isTester
      ? TOPUP_TESTER_MIN_MAJOR_UNITS
      : TOPUP_MIN_MAJOR_UNITS;

    const parsed = createTopupIntentRequestSchema(minAmountMajor).safeParse(
      await request.json()
    );
    if (!parsed.success) {
      return Response.json({ error: "Invalid top-up amount" }, { status: 400 });
    }

    // Top-up requires a subscription (mirrors the dashboard button: it only
    // renders in paid states). "none" ⇔ no subscription row ⇔ no button.
    const latest = await getLatestSubscription(session.user.id);
    const uiState = deriveSubscriptionUiState({
      subscription: latest?.subscription ?? null,
      plan: null,
    });

    if (uiState === "none") {
      return Response.json(
        { error: "Top-up requires a subscription" },
        { status: 403 }
      );
    }

    // The widget charges RUB only; reject mismatched balance currencies.
    const balanceSummary = await ensureBalance(session.user.id);
    if (balanceSummary.currencyCode !== DEFAULT_CURRENCY_CODE) {
      return Response.json(
        { error: "Top-up is only available for RUB balances" },
        { status: 400 }
      );
    }

    const headers = request.headers;
    const clientIp = headers.get("x-forwarded-for") || headers.get("x-real-ip");
    const userAgent = headers.get("user-agent");

    const sessionId = generateSessionId();
    const expiresAt = new Date(Date.now() + INTENT_TTL_MS);
    const amountMajor = parsed.data.amount;

    await db.insert(paymentIntent).values({
      sessionId,
      userId: session.user.id,
      kind: "topup",
      subscriptionId: null,
      currencyCode: DEFAULT_CURRENCY_CODE,
      amount: majorToMinorUnits(amountMajor, RUB_MINOR_UNITS),
      status: "pending",
      metadata: {
        clientIp: clientIp || undefined,
        userAgent: userAgent || undefined,
      },
      expiresAt,
    });

    const response: TopupIntentResponse = {
      sessionId,
      expiresAt: expiresAt.toISOString(),
      amountMajor,
    };

    return Response.json(response);
  } catch (error) {
    console.error("Failed to create top-up intent:", error);
    return Response.json(
      { error: "Failed to create top-up intent" },
      { status: 500 }
    );
  }
}
