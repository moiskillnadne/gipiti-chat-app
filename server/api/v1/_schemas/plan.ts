import { z } from "zod/v4";

import { openEnum } from "@/server/api/_kit/open-enum";
import { moneySchema } from "@/server/api/v1/_schemas/money";

export const KNOWN_BILLING_PERIODS = [
  "daily",
  "weekly",
  "monthly",
  "annual",
] as const;

export const planSchema = z.object({
  code: z
    .string()
    .meta({ description: "Stable identifier, for example basic_monthly." }),
  displayName: z.string(),
  billingPeriod: openEnum(KNOWN_BILLING_PERIODS),
  billingPeriodCount: z.number().int().positive(),
  prices: z.array(moneySchema).meta({
    description:
      "One entry per currency. The price is charged per billing period and credited to the balance.",
  }),
});

export const planListSchema = z.object({
  items: z.array(planSchema),
});

export type Plan = z.infer<typeof planSchema>;
export type PlanList = z.infer<typeof planListSchema>;
