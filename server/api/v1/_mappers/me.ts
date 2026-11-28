import type { Me } from "@/server/api/v1/_schemas/me";
import type { User } from "@/server/db/schema";
import type { BalanceSummary } from "@/server/modules/billing/balance";
import type { TopupBounds } from "@/server/modules/billing/topup-bounds";

type MeInput = {
  user: User;
  hasActiveSubscription: boolean;
  balance: BalanceSummary | null;
  isTopupEnabled: boolean;
  topupBounds: TopupBounds | null;
};

export const toBalanceDto = (
  balance: BalanceSummary
): NonNullable<Me["balance"]> => {
  const { currencyCode } = balance;

  return {
    subscription: { amountMinor: balance.subscriptionAmount, currencyCode },
    topup: { amountMinor: balance.topupAmount, currencyCode },
    total: { amountMinor: balance.total, currencyCode },
  };
};

export const toMeDto = ({
  user,
  hasActiveSubscription,
  balance,
  isTopupEnabled,
  topupBounds,
}: MeInput): Me => ({
  id: user.id,
  email: user.email,
  emailVerified: user.emailVerified,
  isTester: user.isTester,
  hasActiveSubscription,
  balance: balance ? toBalanceDto(balance) : null,
  topup: topupBounds
    ? {
        min: {
          amountMinor: topupBounds.minMinor,
          currencyCode: topupBounds.currencyCode,
        },
        max: {
          amountMinor: topupBounds.maxMinor,
          currencyCode: topupBounds.currencyCode,
        },
      }
    : null,
  features: { topup: isTopupEnabled },
});
