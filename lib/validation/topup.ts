import { z } from "zod";

import {
  TOPUP_MAX_MAJOR_UNITS,
  TOPUP_MIN_MAJOR_UNITS,
} from "@/lib/billing/constants";

// One-time top-up request: an integer amount in MAJOR units (rubles), bounded
// by the product limits. Mirrors the client-side validation in the dialog.
export const topupIntentRequestSchema = z.object({
  amount: z
    .number()
    .int()
    .min(TOPUP_MIN_MAJOR_UNITS)
    .max(TOPUP_MAX_MAJOR_UNITS),
});

export type TopupIntentRequest = z.infer<typeof topupIntentRequestSchema>;
