import Link from "next/link";
import { getTranslations } from "@/lib/i18n/translate";
import type { BalanceViewState } from "@/lib/subscription/subscription-state";
import dash from "../../_components/dashboard.module.css";
import { ArrowLeftIcon } from "../../_components/icons";
import { StatusPill } from "../../_components/status-pill";

type ManageTopNavProps = {
  state: BalanceViewState;
};

export async function ManageTopNav({ state }: ManageTopNavProps) {
  const t = await getTranslations("auth.subscription.manage.topnav");

  return (
    <nav className={dash.topnav}>
      <Link className={dash.back} href="/subscription">
        <ArrowLeftIcon aria-label={t("back")} />
        {t("back")}
      </Link>
      <span className={dash.crumb}>
        {t("crumbSubscription")}
        <span className={dash.crumbSep}>/</span>
        <span className={dash.crumbActive}>{t("crumbManage")}</span>
      </span>
      <div className={dash.navSpacer} />
      <StatusPill state={state} />
    </nav>
  );
}
