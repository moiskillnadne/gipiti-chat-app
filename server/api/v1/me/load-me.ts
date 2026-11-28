import { DEFAULT_CURRENCY_CODE } from "@/lib/billing/constants";
import { toMeDto } from "@/server/api/v1/_mappers/me";
import type { Me } from "@/server/api/v1/_schemas/me";
import { isTopupEnabled } from "@/server/flags";
import { getBalance } from "@/server/modules/billing/balance";
import { getMinorUnits } from "@/server/modules/billing/currencies";
import { getTopupBounds } from "@/server/modules/billing/topup-bounds";
import { getActiveUserSubscription } from "@/server/modules/subscription/queries/get-active-user-subscription";
import { getUserById } from "@/server/modules/users/queries/get-by-id";

/**
 * The account as `/me` shows it, or null when it does not exist.
 *
 * Read from the database on every call: a session holds a snapshot taken at
 * login. The flag is evaluated for this user explicitly, since a caller of
 * the API is not always identified by a cookie.
 */
export const loadMe = async (userId: string): Promise<Me | null> => {
  const [user, activeSubscription, balance, isTopupOn, minorUnits] =
    await Promise.all([
      getUserById(userId),
      getActiveUserSubscription({ userId }),
      getBalance(userId),
      isTopupEnabled.run({ identify: { user: { id: userId } } }),
      getMinorUnits(DEFAULT_CURRENCY_CODE),
    ]);

  if (!user) {
    return null;
  }

  const topupBounds = getTopupBounds({
    isTester: user.isTester,
    minorUnits,
    balanceCurrencyCode: balance?.currencyCode ?? null,
  });

  return toMeDto({
    user,
    hasActiveSubscription: activeSubscription !== null,
    balance,
    isTopupEnabled: isTopupOn,
    topupBounds,
  });
};
