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
import type { BalanceViewState } from "@/lib/subscription/subscription-state";
import { useCancelSubscription } from "@/lib/subscription/use-cancel-subscription";
import styles from "./dashboard.module.css";
import { InfoIcon, PauseIcon, WarnIcon } from "./icons";

const MANAGE_HREF = "/manage-subscription";

export type StatusBannerProps = {
  state: BalanceViewState;
  trialChargeDate: string | null;
  trialPrice: string;
  trialCurrentPeriodEnd: Date | null;
  cancelledDate: string | null;
  cancelledSubAmount: string;
  cancelledTopupAmount: string;
  pastDuePrice: string;
  pastDueCardMask: string | null;
  pastDueRetryIn: string | null;
};

export function StatusBanner(props: StatusBannerProps) {
  switch (props.state) {
    case "trial":
      return <TrialBanner {...props} />;
    case "cancelled":
      return <CancelledBanner {...props} />;
    case "past_due":
      return <PastDueBanner {...props} />;
    case "low":
      return <LowBanner />;
    case "free_zero":
      return <ZeroBanner />;
    default:
      return null;
  }
}

function TrialBanner({
  trialChargeDate,
  trialPrice,
  trialCurrentPeriodEnd,
}: StatusBannerProps) {
  const t = useTranslations("auth.subscription.balance.banner.trial");
  const tDanger = useTranslations("auth.subscription.management.dangerZone");
  const tCommon = useTranslations("common.buttons");
  const cancelFlow = useCancelSubscription({
    currentPeriodEnd: trialCurrentPeriodEnd ?? new Date(),
    isTrial: true,
  });

  return (
    <>
      <div className={`${styles.banner} ${styles.bannerTrial}`}>
        <InfoIcon className={styles.bannerIcon} />
        <div className={styles.bannerBody}>
          <b>{t("title", { date: trialChargeDate ?? "—" })}</b>
          <span>{t("body", { price: trialPrice })}</span>
        </div>
        <div className={styles.bannerActions}>
          <button
            className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
            disabled={!trialCurrentPeriodEnd || cancelFlow.isLoading}
            onClick={cancelFlow.openFeedback}
            type="button"
          >
            {t("cancel")}
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

function CancelledBanner({
  cancelledDate,
  cancelledSubAmount,
  cancelledTopupAmount,
}: StatusBannerProps) {
  const router = useRouter();
  const t = useTranslations("auth.subscription.balance.banner.cancelled");

  return (
    <div className={`${styles.banner} ${styles.bannerCancelled}`}>
      <PauseIcon className={styles.bannerIcon} />
      <div className={styles.bannerBody}>
        <b>{t("title", { date: cancelledDate ?? "—" })}</b>
        <span>
          {t("body", { sub: cancelledSubAmount, topup: cancelledTopupAmount })}
        </span>
      </div>
      <div className={styles.bannerActions}>
        <button
          className={`${styles.btn} ${styles.btnOutline} ${styles.btnSm}`}
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
  pastDuePrice,
  pastDueCardMask,
  pastDueRetryIn,
}: StatusBannerProps) {
  const router = useRouter();
  const t = useTranslations("auth.subscription.balance.banner.pastDue");

  return (
    <div className={`${styles.banner} ${styles.bannerPastDue}`}>
      <WarnIcon className={styles.bannerIcon} />
      <div className={styles.bannerBody}>
        <b>
          {t("title", {
            price: pastDuePrice,
            cardMask: pastDueCardMask ?? "—",
          })}
        </b>
        <span>{t("body", { retryIn: pastDueRetryIn ?? t("soon") })}</span>
      </div>
      <div className={styles.bannerActions}>
        <button
          className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}
          onClick={() => router.push(MANAGE_HREF)}
          type="button"
        >
          {t("updateCard")}
        </button>
      </div>
    </div>
  );
}

function LowBanner() {
  const t = useTranslations("auth.subscription.balance.banner.low");

  return (
    <div className={`${styles.banner} ${styles.bannerLow}`}>
      <WarnIcon className={styles.bannerIcon} />
      <div className={styles.bannerBody}>
        <b>{t("title")}</b>
        <span>{t("body")}</span>
      </div>
    </div>
  );
}

function ZeroBanner() {
  const router = useRouter();
  const t = useTranslations("auth.subscription.balance.banner.zero");

  return (
    <div className={`${styles.banner} ${styles.bannerZero}`}>
      <WarnIcon className={styles.bannerIcon} />
      <div className={styles.bannerBody}>
        <b>{t("title")}</b>
        <span>{t("body")}</span>
      </div>
      <div className={styles.bannerActions}>
        <button
          className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}
          onClick={() => router.push(MANAGE_HREF)}
          type="button"
        >
          {t("subscribe")}
        </button>
      </div>
    </div>
  );
}
