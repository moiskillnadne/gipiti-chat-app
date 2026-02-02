import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/app/(auth)/auth";
import { TokenHistoryTable } from "@/components/token-history-table";
import { TokenUsageSummary } from "@/components/token-usage-summary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function UsageHistoryPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const t = await getTranslations("auth.subscription.history");

  return (
    <div className="container mx-auto max-w-4xl p-6">
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

        <Card>
          <CardHeader>
            <CardTitle>{t("title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <TokenHistoryTable />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
