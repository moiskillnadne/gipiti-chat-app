"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslations } from "@/lib/i18n/translate";
import dash from "../../_components/dashboard.module.css";
import { CheckIcon, XIcon } from "../../_components/icons";
import tu from "../../_components/top-up.module.css";
import styles from "./manage.module.css";
import type { ResumeDialogData } from "./manage-types";

const SUBSCRIBE_HREF = "/manage-subscription";

type ResumeStage =
  | {
      name: "confirm";
      isSubmitting: boolean;
      error: "generic" | "expired" | null;
    }
  | { name: "done" };

const INITIAL_STAGE: ResumeStage = {
  name: "confirm",
  isSubmitting: false,
  error: null,
};

type ResumeDialogProps = {
  data: ResumeDialogData;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ResumeDialog({
  data,
  isOpen,
  onOpenChange,
}: ResumeDialogProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const t = useTranslations("auth.subscription.manage.resume");
  const tManage = useTranslations("auth.subscription.manage");

  const [stage, setStage] = useState<ResumeStage>(INITIAL_STAGE);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        onOpenChange(true);
        return;
      }
      if (stage.name === "confirm" && stage.isSubmitting) {
        return;
      }
      onOpenChange(false);
      if (stage.name === "done") {
        // Subscription resumed — re-render the page behind the dialog.
        // Deferred until close so the dialog is not unmounted mid-flow.
        router.refresh();
      }
      setStage(INITIAL_STAGE);
    },
    [onOpenChange, router, stage]
  );

  const handleConfirm = useCallback(async () => {
    setStage({ name: "confirm", isSubmitting: true, error: null });
    try {
      const res = await fetch("/api/subscription/resume", { method: "POST" });
      if (res.ok) {
        setStage({ name: "done" });
        return;
      }
      setStage({
        name: "confirm",
        isSubmitting: false,
        error: res.status === 410 ? "expired" : "generic",
      });
    } catch {
      setStage({ name: "confirm", isSubmitting: false, error: "generic" });
    }
  }, []);

  const contentClass = isMobile
    ? "top-auto bottom-0 left-0 w-full max-w-none translate-x-0 translate-y-0 rounded-t-[20px] rounded-b-none data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom"
    : "w-[440px] max-w-[calc(100vw-2rem)]";

  const bodyText = data.cardMask
    ? t("body", {
        date: data.dateFull,
        price: data.priceText,
        card: data.cardMask,
      })
    : t("bodyNoCard", { date: data.dateFull, price: data.priceText });

  return (
    <Dialog onOpenChange={handleOpenChange} open={isOpen}>
      <DialogContent aria-describedby={undefined} className={contentClass}>
        <DialogTitle className="sr-only">
          {stage.name === "done" ? t("doneTitle") : t("title")}
        </DialogTitle>
        <div className={`${tu.body} ${isMobile ? tu.bodySheet : ""}`}>
          {stage.name === "confirm" && (
            <>
              <div className={tu.head}>
                <h3 className={tu.title}>{t("title")}</h3>
                <button
                  aria-label={tManage("closeAria")}
                  className={tu.close}
                  disabled={stage.isSubmitting}
                  onClick={() => handleOpenChange(false)}
                  type="button"
                >
                  <XIcon height={14} width={14} />
                </button>
              </div>

              <p className={styles.modalBody}>{bodyText}</p>

              {stage.error === "generic" && (
                <p className={styles.errMsg}>{t("errorGeneric")}</p>
              )}

              {stage.error === "expired" ? (
                <>
                  <p className={styles.errMsg}>{t("errorExpired")}</p>
                  <Link
                    className={`${dash.btn} ${dash.btnPrimary} ${dash.btnFull}`}
                    href={SUBSCRIBE_HREF}
                  >
                    {t("errorExpiredCta")}
                  </Link>
                </>
              ) : (
                <div className={styles.actions}>
                  <button
                    className={`${dash.btn} ${dash.btnPrimary} ${styles.actionGrow}`}
                    disabled={stage.isSubmitting}
                    onClick={handleConfirm}
                    type="button"
                  >
                    {stage.isSubmitting
                      ? t("processing")
                      : stage.error === "generic"
                        ? t("retry")
                        : t("confirm")}
                  </button>
                  <button
                    className={`${dash.btn} ${dash.btnGhost}`}
                    disabled={stage.isSubmitting}
                    onClick={() => handleOpenChange(false)}
                    type="button"
                  >
                    {t("cancel")}
                  </button>
                </div>
              )}
            </>
          )}

          {stage.name === "done" && (
            <div className={tu.result}>
              <div className={`${tu.orb} ${tu.orbOk}`}>
                <CheckIcon />
              </div>
              <h4 className={tu.resultTitle}>{t("doneTitle")}</h4>
              <p className={tu.resultText}>
                {t("doneBody", { date: data.dateFull, price: data.priceText })}
              </p>
              <div className={tu.resultActions}>
                <button
                  className={`${dash.btn} ${dash.btnPrimary} ${dash.btnFull}`}
                  onClick={() => handleOpenChange(false)}
                  type="button"
                >
                  {t("doneOk")}
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
