import { z } from "zod";

import { TOPUP_MAX_MAJOR_UNITS } from "@/lib/billing/constants";

/**
 * One-time top-up request: an integer amount in MAJOR units (rubles), bounded
 * by the product limits. The minimum is caller-supplied because internal
 * testers (`User.isTester`) are allowed amounts below the public minimum.
 * Mirrors the client-side validation in the dialog.
 */
export function createTopupIntentRequestSchema(minAmountMajorUnits: number) {
  return z.object({
    amount: z
      .number()
      .int()
      .min(minAmountMajorUnits)
      .max(TOPUP_MAX_MAJOR_UNITS),
  });
}

export type TopupIntentRequest = z.infer<
  ReturnType<typeof createTopupIntentRequestSchema>
>;
