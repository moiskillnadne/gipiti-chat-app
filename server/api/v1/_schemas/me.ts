import { z } from "zod/v4";

import { moneySchema } from "@/server/api/v1/_schemas/money";

const balanceSchema = z.object({
  subscription: moneySchema.meta({
    description: "Credited on each renewal; spent first; reset on renewal.",
  }),
  topup: moneySchema.meta({
    description: "Top-ups and bonuses; never resets.",
  }),
  total: moneySchema,
});

/** The signed-in user, read from the database on every call. */
export const meSchema = z.object({
  id: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  isTester: z.boolean(),
  hasActiveSubscription: z.boolean(),
  balance: balanceSchema
    .nullable()
    .meta({ description: "Null until the account has a balance row." }),
  features: z.object({
    topup: z.boolean().meta({
      description: "One-time balance top-up is offered to this user.",
    }),
  }),
});

export type Me = z.infer<typeof meSchema>;
