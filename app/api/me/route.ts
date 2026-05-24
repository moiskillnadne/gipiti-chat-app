import { auth } from "@/app/(auth)/auth";
import { getBalance } from "@/lib/billing/balance";
import { getMinorUnits } from "@/lib/billing/currencies";
import { formatCurrency } from "@/lib/billing/money";
import { getActiveUserSubscription } from "@/lib/billing/subscriptions";
import { getUserById } from "@/lib/db/query/user/get-by-id";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;

  const [userRecord, subscription, balanceSummary] = await Promise.all([
    getUserById(userId),
    getActiveUserSubscription(userId),
    getBalance(userId),
  ]);

  if (!userRecord) {
    return new Response("User not found", { status: 404 });
  }

  const minorUnits = balanceSummary
    ? await getMinorUnits(balanceSummary.currencyCode)
    : 2;

  return Response.json({
    id: userRecord.id,
    email: userRecord.email,
    emailVerified: userRecord.emailVerified,
    isTester: userRecord.isTester,
    hasActiveSubscription: subscription !== null,
    balance: balanceSummary
      ? {
          currencyCode: balanceSummary.currencyCode,
          total: balanceSummary.total,
          formatted: formatCurrency(
            balanceSummary.total,
            balanceSummary.currencyCode,
            minorUnits
          ),
        }
      : null,
  });
}
