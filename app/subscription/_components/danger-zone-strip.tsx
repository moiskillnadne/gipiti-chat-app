"use client";

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
import { useCancelSubscription } from "@/lib/subscription/use-cancel-subscription";
import { formatRuDate } from "@/lib/utils/format-billing";
import styles from "./dashboard.module.css";
import { WarnIcon } from "./icons";

type DangerZoneStripProps = {
  currentPeriodEnd: Date;
};

export function DangerZoneStrip({ currentPeriodEnd }: DangerZoneStripProps) {
  const t = useTranslations("auth.subscription.dashboard.danger");
  const tDanger = useTranslations("auth.subscription.management.dangerZone");
  const tCommon = useTranslations("common.buttons");
  const cancelFlow = useCancelSubscription({
    currentPeriodEnd,
    isTrial: false,
  });

  return (
    <>
      <div className={styles.cardSpan2}>
        <div className={styles.danger}>
          <WarnIcon className={styles.dangerIcon} />
          <div className={styles.dangerText}>
            <b>{t("title")}</b>
            <span>{t("description")}</span>
          </div>
          <button
            className={`${styles.btn} ${styles.btnDanger}`}
            disabled={cancelFlow.isLoading}
            onClick={cancelFlow.openFeedback}
            type="button"
          >
            {t("cancelButton")}
          </button>
        </div>
      </div>

      <CancellationFeedbackDialog
        isLoading={cancelFlow.isLoading}
        isOpen={cancelFlow.isFeedbackOpen}
        isTrial={false}
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
            <AlertDialogTitle>{tDanger("confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tDanger("confirmDescription", {
                date: formatRuDate(currentPeriodEnd),
              })}
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
