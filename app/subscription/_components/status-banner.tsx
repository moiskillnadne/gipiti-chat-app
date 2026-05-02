"use client";

import { useRouter } from "next/navigation";
import { CancellationFeedbackDialog } from "@/components/cancellation-feedback-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTranslations } from "@/lib/i18n/translate";
import type { SubscriptionUiState } from "@/lib/subscription/subscription-state";
import { useCancelSubscription } from "@/lib/subscription/use-cancel-subscription";
import {
  formatRuDate,
  pluralRu,
  type RuPluralForms,
} from "@/lib/utils/format-billing";
import styles from "./dashboard.module.css";
import { PauseIcon, SparkIcon, WarnIcon } from "./icons";

const DAY_FORMS: RuPluralForms = ["день", "дня", "дней"];

const MANAGE_HREF = "/manage-subscription";

type StatusBannerProps = {
  state: SubscriptionUiState;
  trialDaysLeft: number;
  trialChargingStartDate: Date | null;
  trialPlanName: string;
  trialPriceLabel: string;
  cancelEndDate: Date | null;
  pastDuePriceLabel: string;
  pastDueCardMask: string | null;
  cancelCurrentPeriodEnd: Date | null;
};

export function StatusBanner(props: StatusBannerProps) {
  if (props.state === "active") {
    return null;
  }

  if (props.state === "trial") {
    return <TrialBanner {...props} />;
  }

  if (props.state === "cancelled") {
    return <CancelledBanner {...props} />;
  }

  if (props.state === "past_due") {
    return <PastDueBanner {...props} />;
  }

  return <NoneBanner />;
}

function TrialBanner({
  trialDaysLeft,
  trialChargingStartDate,
  trialPlanName,
  trialPriceLabel,
  cancelCurrentPeriodEnd,
}: StatusBannerProps) {
  const router = useRouter();
  const t = useTranslations("auth.subscription.dashboard.banner.trial");
  const tDanger = useTranslations("auth.subscription.management.dangerZone");
  const tCommon = useTranslations("common.buttons");
  const cancelFlow = useCancelSubscription({
    currentPeriodEnd: cancelCurrentPeriodEnd ?? new Date(),
    isTrial: true,
  });

  const dayWord = pluralRu(trialDaysLeft, DAY_FORMS);
  const endDateText = trialChargingStartDate
    ? formatRuDate(trialChargingStartDate)
    : "—";

  return (
    <>
      <div className={`${styles.banner} ${styles.bannerTrial}`}>
        <SparkIcon className={styles.bannerIcon} />
        <div className={styles.bannerBody}>
          <b>{t("title", { days: trialDaysLeft, dayWord })}</b>
          <span>
            {t("body", {
              endDate: endDateText,
              planName: trialPlanName,
              price: trialPriceLabel,
            })}
          </span>
        </div>
        <div className={styles.bannerActions}>
          <button
            className={`${styles.btn} ${styles.btnOutline} ${styles.btnSm}`}
            disabled={!cancelCurrentPeriodEnd || cancelFlow.isLoading}
            onClick={cancelFlow.openFeedback}
            type="button"
          >
            {t("cancel")}
          </button>
          <button
            className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}
            onClick={() => router.push(MANAGE_HREF)}
            type="button"
          >
            {t("upgrade")}
          </button>
        </div>
      </div>

      <CancellationFeedbackDialog
        isLoading={cancelFlow.isLoading}
        isOpen={cancelFlow.isFeedbackOpen}
        isTrial
        onOpenChange={(open) =>
          open ? cancelFlow.openFeedback() : cancelFlow.closeFeedback()
        }
        onSubmit={cancelFlow.submitFeedback}
      />

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            cancelFlow.closeConfirm();
          }
        }}
        open={cancelFlow.isConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tDanger("confirmTitleTrial")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tDanger("confirmDescriptionTrial")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelFlow.isLoading}>
              {tCommon("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={cancelFlow.isLoading}
              onClick={(e) => {
                e.preventDefault();
                cancelFlow.confirmCancel();
              }}
            >
              {cancelFlow.isLoading
                ? tDanger("cancelling")
                : tDanger("confirmButton")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function CancelledBanner({ cancelEndDate }: StatusBannerProps) {
  const router = useRouter();
  const t = useTranslations("auth.subscription.dashboard.banner.cancelled");
  const endDateText = cancelEndDate ? formatRuDate(cancelEndDate) : "—";

  return (
    <div className={`${styles.banner} ${styles.bannerCancelled}`}>
      <PauseIcon className={styles.bannerIcon} />
      <div className={styles.bannerBody}>
        <b>{t("title", { endDate: endDateText })}</b>
        <span>{t("body")}</span>
      </div>
      <div className={styles.bannerActions}>
        <button
          className={`${styles.btn} ${styles.btnAccent} ${styles.btnSm}`}
          onClick={() => router.push(MANAGE_HREF)}
          type="button"
        >
          {t("resume")}
        </button>
      </div>
    </div>
  );
}

function PastDueBanner({
  pastDuePriceLabel,
  pastDueCardMask,
}: StatusBannerProps) {
  const router = useRouter();
  const t = useTranslations("auth.subscription.dashboard.banner.pastDue");

  return (
    <div className={`${styles.banner} ${styles.bannerPastDue}`}>
      <WarnIcon className={styles.bannerIcon} />
      <div className={styles.bannerBody}>
        <b>{t("title")}</b>
        <span>
          {t("body", {
            price: pastDuePriceLabel,
            cardMask: pastDueCardMask ?? "—",
          })}
        </span>
      </div>
      <div className={styles.bannerActions}>
        <button
          className={`${styles.btn} ${styles.btnOutline} ${styles.btnSm}`}
          onClick={() => router.push(MANAGE_HREF)}
          type="button"
        >
          {t("retry")}
        </button>
        <button
          className={`${styles.btn} ${styles.btnDanger} ${styles.btnSm}`}
          onClick={() => router.push(MANAGE_HREF)}
          type="button"
        >
          {t("updateCard")}
        </button>
      </div>
    </div>
  );
}

function NoneBanner() {
  const t = useTranslations("auth.subscription.dashboard.banner.none");

  return (
    <div className={`${styles.banner} ${styles.bannerNone}`}>
      <SparkIcon className={styles.bannerIcon} />
      <div className={styles.bannerBody}>
        <b>{t("title")}</b>
        <span>{t("body")}</span>
      </div>
    </div>
  );
}
