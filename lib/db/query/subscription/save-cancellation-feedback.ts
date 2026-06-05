import { ChatSDKError } from "../../../errors";
import { db } from "../../connection";
import { cancellationFeedback } from "../../schema";

export async function saveCancellationFeedback({
  userId,
  subscriptionId,
  reasons,
  additionalFeedback,
  planName,
  billingPeriod,
  subscriptionDurationDays,
}: {
  userId: string;
  subscriptionId: string;
  reasons: string[];
  additionalFeedback?: string;
  planName?: string;
  billingPeriod?: "daily" | "weekly" | "monthly" | "annual";
  subscriptionDurationDays?: number;
}): Promise<void> {
  try {
    await db.insert(cancellationFeedback).values({
      userId,
      subscriptionId,
      reasons,
      additionalFeedback: additionalFeedback || null,
      subscriptionCode: planName || null,
      billingPeriod: billingPeriod || null,
      subscriptionDurationDays: subscriptionDurationDays || null,
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to save cancellation feedback"
    );
  }
}
