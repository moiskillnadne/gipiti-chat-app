import type { BalanceSummary } from "@/lib/billing/balance";
import type { User } from "@/lib/db/schema";
import type { Me } from "@/server/api/v1/_schemas/me";

type MeInput = {
  user: User;
  hasActiveSubscription: boolean;
  balance: BalanceSummary | null;
  isTopupEnabled: boolean;
};

const toBalanceDto = (balance: BalanceSummary): NonNullable<Me["balance"]> => {
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
}: MeInput): Me => ({
  id: user.id,
  email: user.email,
  emailVerified: user.emailVerified,
  isTester: user.isTester,
  hasActiveSubscription,
  balance: balance ? toBalanceDto(balance) : null,
  features: { topup: isTopupEnabled },
});
