import { formatCurrency } from "@/lib/billing/money";
import { auth } from "@/server/modules/auth/next-auth";
import { getBalance } from "@/server/modules/billing/balance";
import { getMinorUnits } from "@/server/modules/billing/currencies";
import { getSpendProgress } from "@/server/modules/billing/spend";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;

  const balanceSummary = await getBalance(userId);

  if (!balanceSummary) {
    return Response.json({ balance: null, spend: null });
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
    spend,
  });
}
