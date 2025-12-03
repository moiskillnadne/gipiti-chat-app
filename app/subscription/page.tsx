import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChevronLeftIcon } from "lucide-react";
import { auth } from "@/app/(auth)/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getUserSubscriptionWithPlan } from "@/lib/db/queries";

export default async function SubscriptionPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const t = await getTranslations("auth.subscription.management");
  const tCommon = await getTranslations("common.buttons");

  const subscriptionData = await getUserSubscriptionWithPlan({
    userId: session.user.id,
  });

  const formatDate = (date: Date | null | undefined) => {
    if (!date) {
      return t("notAvailable");
    }

    return new Intl.DateTimeFormat("ru-RU", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(date));
  };

  const formatCurrency = (amount: string | null | undefined) => {
    if (!amount) {
      return t("notAvailable");
    }

    const numAmount = Number.parseFloat(amount);
    return `${numAmount.toLocaleString("ru-RU")} ₽`;
  };

  const formatBillingPeriod = (
    billingPeriod: string | null | undefined,
    billingPeriodCount: number | null | undefined
  ) => {
    if (!billingPeriod) {
      return t("notAvailable");
    }

    const periodKey = billingPeriod as
      | "daily"
      | "weekly"
      | "monthly"
      | "annual";
    const periodLabel = t(`billingPeriods.${periodKey}`);

    const count = billingPeriodCount ?? 1;
    if (count === 1) {
      return periodLabel;
    }

    return `${count} ${periodLabel}`;
  };

  if (!subscriptionData) {
    return (
      <div className="container mx-auto max-w-4xl p-6">
        <div className="mb-4">
          <Link href="/">
            <Button variant="ghost" className="gap-2">
              <ChevronLeftIcon size={16} />
              {tCommon("back")}
            </Button>
          </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("noSubscriptionDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/subscribe">
              <Button>{t("subscribeLink")}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { subscription, plan } = subscriptionData;

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <div className="mb-4">
        <Link href="/">
          <Button variant="ghost" className="gap-2">
            <ChevronLeftIcon size={16} />
            {tCommon("back")}
          </Button>
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h3 className="font-medium text-muted-foreground text-sm">
                {t("planName")}
              </h3>
              <p className="font-semibold text-lg">
                {plan.displayName || plan.name}
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium text-muted-foreground text-sm">
                {t("billingPeriod")}
              </h3>
              <p className="text-lg">
                {formatBillingPeriod(
                  plan.billingPeriod,
                  plan.billingPeriodCount
                )}
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium text-muted-foreground text-sm">
                {t("latestPurchaseDate")}
              </h3>
              <p className="text-lg">
                {formatDate(subscription.lastPaymentDate)}
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium text-muted-foreground text-sm">
                {t("latestPurchaseAmount")}
              </h3>
              <p className="text-lg">
                {formatCurrency(subscription.lastPaymentAmount)}
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium text-muted-foreground text-sm">
                {t("nextPaymentDate")}
              </h3>
              <p className="text-lg">
                {formatDate(subscription.nextBillingDate)}
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium text-muted-foreground text-sm">
                {t("nextPaymentAmount")}
              </h3>
              <p className="text-lg">{formatCurrency(plan.price)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

