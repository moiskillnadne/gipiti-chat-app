import { z } from "zod/v4";

/**
 * An amount of money: an integer in the currency's minor units (kopecks for
 * RUB) and the ISO 4217 code. Clients format it themselves.
 */
export const moneySchema = z.object({
  amountMinor: z.number().int(),
  currencyCode: z.string().length(3),
});

export type Money = z.infer<typeof moneySchema>;
