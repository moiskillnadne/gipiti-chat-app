import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/app/(auth)/auth";
import { CancelSubscriptionButton } from "@/components/cancel-subscription-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getUserSubscriptionWithPlan } from "@/lib/db/queries";
import { SUBSCRIPTION_TIERS } from "../../lib/subscription/subscription-tiers";

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
            <Button className="gap-2" variant="ghost">
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

  const subscriptionPriceInRubles =
    SUBSCRIPTION_TIERS[plan.name]?.price.RUB ?? plan.price;

  const getStatusBadge = (status: string) => {
    if (status === "cancelled") {
      return (
        <Badge className="w-fit" variant="destructive">
          {t("statusCancelled")}
        </Badge>
      );
    }

    if (status === "past_due") {
      return (
        <Badge
          className="w-fit border-yellow-500 text-yellow-600"
          variant="outline"
        >
          {t("statusPastDue")}
        </Badge>
      );
    }

    return (
      <Badge className="w-fit bg-green-100 text-green-800" variant="secondary">
        {t("statusActive")}
      </Badge>
    );
  };

  const isCancelled =
    subscription.status === "cancelled" || subscription.cancelAtPeriodEnd;
  const showNextPaymentInfo =
    subscription.status === "active" && !subscription.cancelAtPeriodEnd;
  const showNoFurtherCharges =
    subscription.status === "active" && subscription.cancelAtPeriodEnd;

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <div className="mb-4">
        <Link href="/">
          <Button className="gap-2" variant="ghost">
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
          <div className="space-y-2">
            <h3 className="font-medium text-muted-foreground text-sm">
              {t("status")}
            </h3>
            <div className="flex flex-col gap-2">
              {getStatusBadge(subscription.status)}
              {subscription.cancelledAt && (
                <p className="text-muted-foreground text-sm">
                  {t("cancelledOn", {
                    date: formatDate(subscription.cancelledAt),
                  })}
                </p>
              )}
            </div>
          </div>

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

            {showNextPaymentInfo && (
              <>
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
                  <p className="text-lg">
                    {formatCurrency(subscriptionPriceInRubles.toString())}
                  </p>
                </div>
              </>
            )}

            {showNoFurtherCharges && (
              <div className="space-y-2 md:col-span-2">
                <h3 className="font-medium text-muted-foreground text-sm">
                  {t("nextPaymentInfo")}
                </h3>
                <p className="text-lg">{t("noFurtherCharges")}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd && (
        <Card className="mt-6 border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">
              {t("willCancelAt", {
                date: formatDate(subscription.currentPeriodEnd),
              })}
            </CardTitle>
            <CardDescription className="text-destructive">
              {t("noFurtherCharges")}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {subscription.status === "active" && !subscription.cancelAtPeriodEnd && (
        <Card className="mt-6 border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">
              {t("dangerZone.title")}
            </CardTitle>
            <CardDescription>{t("dangerZone.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <CancelSubscriptionButton
              currentPeriodEnd={subscription.currentPeriodEnd}
              isAlreadyCancelled={isCancelled}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
