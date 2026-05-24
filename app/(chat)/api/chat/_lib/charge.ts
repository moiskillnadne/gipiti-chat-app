import { chargeUsage } from "@/lib/billing/balance";

type ChargeUsageArgs = Parameters<typeof chargeUsage>[0];

/**
 * Charge a provider USD cost to the user's balance, swallowing failures with a
 * warning. A billing hiccup must never break the user's stream — mirrors the
 * previous inline try/catch at the chat and image-generation charge sites.
 */
export async function chargeUsageSafe(
  args: ChargeUsageArgs,
  label = "usage"
): Promise<void> {
  try {
    await chargeUsage(args);
  } catch (err) {
    console.warn(`Failed to charge ${label}`, err);
  }
}
