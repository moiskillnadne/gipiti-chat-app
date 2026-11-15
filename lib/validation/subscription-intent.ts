import { z } from "zod";

const MAX_PLAN_CODE_LENGTH = 64;

/**
 * Subscription payment-intent request: the stable plan code
 * (`Subscription.code`, e.g. "basic_monthly").
 */
export const createSubscriptionIntentRequestSchema = z.object({
  planName: z.string().min(1).max(MAX_PLAN_CODE_LENGTH),
});

export type SubscriptionIntentRequest = z.infer<
  typeof createSubscriptionIntentRequestSchema
>;
