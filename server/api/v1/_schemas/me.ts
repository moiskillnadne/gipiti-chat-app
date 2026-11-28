import { z } from "zod/v4";

import { moneySchema } from "@/server/api/v1/_schemas/money";

export const balanceSchema = z.object({
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
  hasActiveSubscription: z.boolean().meta({
    description:
      "A login-time style flag: true when a subscription has status `active` and its period end is still in the future. It can differ from `state` of `GET /me/subscription` between the period end and the renewal. Use `state` to decide what to show and whether to offer a top-up.",
  }),
  balance: balanceSchema
    .nullable()
    .meta({ description: "Null until the account has a balance row." }),
  topup: z.object({ min: moneySchema, max: moneySchema }).nullable().meta({
    description:
      "The smallest and the largest one-time top-up this user may make, in the currency the payment widget charges. The amount must be a whole number of major units (750 RUB is accepted, 750.50 is refused). Null when the balance is in another currency, where a top-up is refused. A top-up is offered only when `features.topup` is true and `GET /me/subscription` has a `state` other than `none` (no subscription, or one that has ended): otherwise it is refused with 403. A tester's minimum is lower.",
  }),
  features: z.object({
    topup: z.boolean().meta({
      description: "One-time balance top-up is offered to this user.",
    }),
  }),
});

export type Me = z.infer<typeof meSchema>;
