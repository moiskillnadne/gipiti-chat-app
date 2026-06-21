import { auth } from "@/app/(auth)/auth";
import { getBalance } from "@/lib/billing/balance";
import { getMinorUnits } from "@/lib/billing/currencies";
import { formatCurrency } from "@/lib/billing/money";
import { getSpendProgress } from "@/lib/billing/spend";
import { getActiveUserSubscription } from "@/lib/billing/subscriptions";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;

  const [balanceSummary, subscription] = await Promise.all([
    getBalance(userId),
    getActiveUserSubscription(userId),
  ]);

  if (!balanceSummary) {
    return Response.json({ balance: null, subscription, spend: null });
  }

  const [minorUnits, spend] = await Promise.all([
    getMinorUnits(balanceSummary.currencyCode),
    getSpendProgress(userId, balanceSummary),
  ]);

  return Response.json({
    balance: {
      currencyCode: balanceSummary.currencyCode,
      subscriptionAmount: balanceSummary.subscriptionAmount,
      topupAmount: balanceSummary.topupAmount,
      total: balanceSummary.total,
      formatted: formatCurrency(
        balanceSummary.total,
        balanceSummary.currencyCode,
        minorUnits
      ),
    },
    subscription,
    spend,
  });
}
