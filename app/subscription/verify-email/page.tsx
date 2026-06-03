import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { getBalance } from "@/lib/billing/balance";
import { EMAIL_CONFIRM_BONUS_MAJOR_UNITS } from "@/lib/billing/constants";
import { getMinorUnits } from "@/lib/billing/currencies";
import { formatCurrency, majorToMinorUnits } from "@/lib/billing/money";
import { VerifyEmailClient } from "./_components/verify-email-client";

export default async function VerifyEmailPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const userEmail = session.user.email ?? null;

  // Nothing to confirm once the address is verified (or missing entirely).
  if (session.user.emailVerified || userEmail === null) {
    return redirect("/subscription");
  }

  const balanceSummary = await getBalance(session.user.id);
  const currencyCode = balanceSummary?.currencyCode ?? "RUB";
  const minorUnits = balanceSummary ? await getMinorUnits(currencyCode) : 2;

  const bonusAmount = formatCurrency(
    majorToMinorUnits(EMAIL_CONFIRM_BONUS_MAJOR_UNITS, minorUnits),
    currencyCode,
    minorUnits
  );

  return <VerifyEmailClient bonusAmount={bonusAmount} email={userEmail} />;
}
