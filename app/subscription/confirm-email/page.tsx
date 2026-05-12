import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import dashboardStyles from "@/app/subscription/_components/dashboard.module.css";
import { SubscriptionTopNav } from "@/app/subscription/_components/subscription-top-nav";
import { getLatestUserSubscriptionWithPlan } from "@/lib/db/queries";
import { getTranslations } from "@/lib/i18n/translate";
import {
  deriveSubscriptionUiState,
  type SubscriptionUiState,
} from "@/lib/subscription/subscription-state";
import { ConfirmEmailForm } from "./_components/confirm-email-form";

export default async function ConfirmEmailPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const subscriptionData = await getLatestUserSubscriptionWithPlan({
    userId: session.user.id,
  });

  const subscription = subscriptionData?.subscription ?? null;
  const plan = subscriptionData?.plan ?? null;
  const state: SubscriptionUiState = deriveSubscriptionUiState({
    subscription,
    plan,
  });

  const t = await getTranslations("auth.confirmEmail");
  const isAlreadyVerified = session.user.emailVerified === true;
  const initialView = isAlreadyVerified ? "success" : "otp";

  return (
    <>
      <SubscriptionTopNav state={state} subCrumb={t("pageCrumb")} />
      <main className={dashboardStyles.body}>
        <div className={dashboardStyles.head}>
          <div>
            <h1 className={dashboardStyles.headTitle}>
              {t("title")}
              <em>
                {isAlreadyVerified ? t("successTitleSuffix") : t("titleEm")}
              </em>
            </h1>
            <p className={dashboardStyles.headLede}>
              {isAlreadyVerified ? t("successHeadLede") : t("lede")}
            </p>
          </div>
          <div className={dashboardStyles.cycle}>
            {t("cycleLabel")}
            <b>{t("cycleValue")}</b>
          </div>
        </div>

        <ConfirmEmailForm initialView={initialView} />
      </main>
    </>
  );
}
