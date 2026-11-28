import {
  MIN_IMAGE_TURN_BALANCE_MINOR,
  MIN_TEXT_TURN_BALANCE_MINOR,
  MIN_VIDEO_TURN_BALANCE_MINOR,
  USAGE_MARKUP,
} from "@/lib/billing/constants";
import { usdToMinorUnits } from "@/lib/billing/money";
import { getBalance } from "./balance";
import { type CurrencyPricing, getCurrencyPricing } from "./fx";

export type TurnBalanceMode = "text" | "image" | "video";

/** Result of the pre-inference gate, in minor units of the user's currency. */
export type TurnBalanceCheck = {
  isSufficient: boolean;
  requiredMinor: number;
  availableMinor: number;
};

type RequiredTurnBalanceInput = {
  mode: TurnBalanceMode;
  /** The model's cost per generation at its defaults (media models only). */
  estimatedCostUsd?: number;
  pricing?: CurrencyPricing;
};

const hasCostEstimate = (
  mode: TurnBalanceMode,
  estimatedCostUsd: number | undefined
): estimatedCostUsd is number =>
  mode !== "text" && estimatedCostUsd !== undefined && estimatedCostUsd > 0;

/**
 * Minimum balance (minor units) a turn needs before inference starts.
 *
 * Text: a constant floor. Image/video: the model's estimate priced exactly like
 * a charge (FX rate × `USAGE_MARKUP`). Without an estimate, or without a cached
 * FX rate (in which state `chargeUsage` cannot price the turn either), the
 * per-mode floor applies.
 */
export const requiredTurnBalanceMinor = ({
  mode,
  estimatedCostUsd,
  pricing,
}: RequiredTurnBalanceInput): number => {
  if (mode === "text") {
    return MIN_TEXT_TURN_BALANCE_MINOR;
  }
  const modeFloor =
    mode === "image"
      ? MIN_IMAGE_TURN_BALANCE_MINOR
      : MIN_VIDEO_TURN_BALANCE_MINOR;
  if (!hasCostEstimate(mode, estimatedCostUsd) || pricing?.fxRate == null) {
    return modeFloor;
  }
  return usdToMinorUnits({
    usdCost: estimatedCostUsd,
    fxRate: pricing.fxRate,
    minorUnits: pricing.minorUnits,
    markup: USAGE_MARKUP,
  });
};

/**
 * Pre-inference gate: does the user's spendable balance cover the minimum for
 * this turn? A user without a balance row has nothing to spend.
 */
export async function checkTurnBalance({
  userId,
  mode,
  estimatedCostUsd,
}: {
  userId: string;
  mode: TurnBalanceMode;
  estimatedCostUsd?: number;
}): Promise<TurnBalanceCheck> {
  const summary = await getBalance(userId);
  const availableMinor = summary?.total ?? 0;

  const pricing =
    summary && hasCostEstimate(mode, estimatedCostUsd)
      ? await getCurrencyPricing(summary.currencyCode)
      : undefined;
  const requiredMinor = requiredTurnBalanceMinor({
    mode,
    estimatedCostUsd,
    pricing,
  });

  return {
    isSufficient: summary !== null && availableMinor >= requiredMinor,
    requiredMinor,
    availableMinor,
  };
}
