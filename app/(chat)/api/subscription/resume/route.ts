import { auth } from "@/app/(auth)/auth";
import { resumeSubscription } from "@/lib/subscription/resume-subscription";

/**
 * Re-enables auto-renewal for the user's soft-cancelled subscription.
 * 200 — resumed (or there was nothing to resume); 410 — the paid period
 * already ended, the user must re-subscribe; 502 — CloudPayments failed.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await resumeSubscription(session.user.id);

  switch (result.outcome) {
    case "resumed":
      return Response.json({ success: true, alreadyActive: false });
    case "already_active":
    case "flags_cleared":
      return Response.json({ success: true, alreadyActive: true });
    case "expired":
      return Response.json({ error: "subscription_expired" }, { status: 410 });
    default:
      return Response.json(
        { error: "payment_provider_error" },
        { status: 502 }
      );
  }
}
