import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TokenHistoryTable } from "@/components/token-history-table";
import { TokenUsageSummary } from "@/components/token-usage-summary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTranslations } from "@/lib/i18n/translate";
import { auth } from "@/server/modules/auth/next-auth";

export default async function UsageHistoryPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const t = await getTranslations("auth.subscription.history");

  return (
    <div className="container mx-auto max-w-4xl p-4 md:p-6">
      <div className="mb-4">
        <Link href="/subscription">
          <Button className="gap-2" variant="ghost">
            <ChevronLeftIcon size={16} />
            {t("backToSubscription")}
          </Button>
        </Link>
      </div>

      <div className="space-y-6">
        <TokenUsageSummary showHistoryButton={false} />

        {/* On phones the card's 24px padding on top of the page's 16px left the list ~240px */}
        <Card data-history-card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle>{t("title")}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <TokenHistoryTable />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
