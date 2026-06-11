import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { saveCancellationFeedback } from "@/lib/db/query/subscription/save-cancellation-feedback";
import {
  type CancellationReasonCode,
  VALID_REASON_CODES,
} from "@/lib/subscription/cancellation-reasons";
import { getLatestSubscription } from "@/lib/subscription/get-latest-subscription";

const MAX_FEEDBACK_LENGTH = 2000;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const bodySchema = z
  .object({
    reason: z
      .string()
      .refine((code): code is CancellationReasonCode =>
        VALID_REASON_CODES.includes(code as CancellationReasonCode)
      )
      .optional(),
    additionalFeedback: z
      .string()
      .trim()
      .min(1)
      .max(MAX_FEEDBACK_LENGTH)
      .optional(),
  })
  .refine(
    (body) =>
      body.reason !== undefined || body.additionalFeedback !== undefined,
    { message: "Either reason or additionalFeedback is required" }
  );

/**
 * Records the optional post-cancellation survey. Called by the cancel flow
 * after the subscription is already cancelled, so this is best-effort from
 * the client's perspective — but invalid payloads are still rejected.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  let parsedBody: z.infer<typeof bodySchema>;
  try {
    parsedBody = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const latest = await getLatestSubscription(session.user.id);
  if (!latest) {
    return Response.json({ error: "No subscription found" }, { status: 404 });
  }

  const subscriptionDurationDays = Math.floor(
    (Date.now() - latest.subscription.createdAt.getTime()) / MS_PER_DAY
  );

  try {
    await saveCancellationFeedback({
      userId: session.user.id,
      subscriptionId: latest.subscription.id,
      reasons: parsedBody.reason ? [parsedBody.reason] : [],
      additionalFeedback: parsedBody.additionalFeedback,
      planName: latest.code,
      billingPeriod: latest.billingPeriod,
      subscriptionDurationDays,
    });
  } catch (error) {
    console.error("Failed to save cancellation feedback:", error);
    return Response.json({ error: "Failed to save feedback" }, { status: 500 });
  }

  return Response.json({ success: true });
}
