import {
  DEFAULT_CURRENCY_CODE,
  TOPUP_MAX_MAJOR_UNITS,
  TOPUP_MIN_MAJOR_UNITS,
  TOPUP_TESTER_MIN_MAJOR_UNITS,
} from "@/lib/billing/constants";
import { majorToMinorUnits } from "@/lib/billing/money";

export type TopupBounds = {
  currencyCode: string;
  minMinor: number;
  maxMinor: number;
};

/**
 * The smallest top-up in major units of the default currency. Testers get a
 * lowered minimum to check the payment flow cheaply; this is what the
 * create-intent route and the CloudPayments check webhook enforce.
 */
export const minTopupMajorUnits = (isTester: boolean): number =>
  isTester ? TOPUP_TESTER_MIN_MAJOR_UNITS : TOPUP_MIN_MAJOR_UNITS;

/**
 * The top-up bounds for one user, or null when the user cannot top up: the
 * widget charges the default currency only, so a balance in another currency
 * is refused by the create-intent route. A user with no balance row is
 * served in the default currency (the route creates the row in it).
 *
 * Whether the account also has a subscription (the route refuses a top-up
 * without one) is not part of the bounds.
 */
export const getTopupBounds = ({
  isTester,
  minorUnits,
  balanceCurrencyCode,
}: {
  isTester: boolean;
  /** Minor-unit exponent of the default currency (`getMinorUnits`). */
  minorUnits: number;
  /** The currency of the user's balance row, or null when there is none. */
  balanceCurrencyCode: string | null;
}): TopupBounds | null => {
  if (
    balanceCurrencyCode !== null &&
    balanceCurrencyCode !== DEFAULT_CURRENCY_CODE
  ) {
    return null;
  }

  return {
    currencyCode: DEFAULT_CURRENCY_CODE,
    minMinor: majorToMinorUnits(minTopupMajorUnits(isTester), minorUnits),
    maxMinor: majorToMinorUnits(TOPUP_MAX_MAJOR_UNITS, minorUnits),
  };
};
