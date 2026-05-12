import Link from "next/link";
import { getTranslations } from "@/lib/i18n/translate";
import type { SubscriptionUiState } from "@/lib/subscription/subscription-state";
import styles from "./dashboard.module.css";
import { ArrowLeftIcon } from "./icons";
import { StatusPill } from "./status-pill";

type SubscriptionTopNavProps = {
  state: SubscriptionUiState;
  subCrumb?: string;
};

export async function SubscriptionTopNav({
  state,
  subCrumb,
}: SubscriptionTopNavProps) {
  const t = await getTranslations("auth.subscription.dashboard.topnav");

  return (
    <nav className={styles.topnav}>
      <Link className={styles.back} href="/">
        <ArrowLeftIcon aria-label={t("back")} />
        {t("back")}
      </Link>
      <span className={styles.crumb}>
        {t("crumbAccount")}
        <span className={styles.crumbSep}>/</span>
        {subCrumb ? (
          <>
            <Link className={styles.crumbLink} href="/subscription">
              {t("crumbSubscription")}
            </Link>
            <span className={styles.crumbSep}>/</span>
            <span className={styles.crumbActive}>{subCrumb}</span>
          </>
        ) : (
          <span className={styles.crumbActive}>{t("crumbSubscription")}</span>
        )}
      </span>
      <div className={styles.navSpacer} />
      <StatusPill state={state} />
    </nav>
  );
}
