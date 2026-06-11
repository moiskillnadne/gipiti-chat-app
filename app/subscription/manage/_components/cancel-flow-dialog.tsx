"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslations } from "@/lib/i18n/translate";
import tu from "../../_components/top-up.module.css";
import {
  CancelConfirmStage,
  CancelDoneStage,
  CancelSurveyStage,
} from "./cancel-stages";
import type { CancelDialogData } from "./manage-types";

type CancelStage =
  | { name: "confirm"; isSubmitting: boolean; hasError: boolean }
  | { name: "survey"; isSubmitting: boolean }
  | { name: "done" };

const INITIAL_STAGE: CancelStage = {
  name: "confirm",
  isSubmitting: false,
  hasError: false,
};

type CancelFlowDialogProps = {
  data: CancelDialogData;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CancelFlowDialog({
  data,
  isOpen,
  onOpenChange,
}: CancelFlowDialogProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const t = useTranslations("auth.subscription.manage.cancel");

  const [stage, setStage] = useState<CancelStage>(INITIAL_STAGE);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        onOpenChange(true);
        return;
      }
      // Block closing while the cancel request is in flight.
      if (stage.name === "confirm" && stage.isSubmitting) {
        return;
      }
      onOpenChange(false);
      if (stage.name !== "confirm") {
        // Cancellation already happened — re-render the page behind the
        // dialog so it flips to the cancelled state. Deferred until close so
        // the survey/done steps are not unmounted mid-flow.
        router.refresh();
      }
      setStage(INITIAL_STAGE);
    },
    [onOpenChange, router, stage]
  );

  const handleConfirm = useCallback(async () => {
    setStage({ name: "confirm", isSubmitting: true, hasError: false });
    try {
      const res = await fetch("/api/subscription", { method: "DELETE" });
      if (!res.ok) {
        throw new Error(`Cancel request failed with status ${res.status}`);
      }
      setStage({ name: "survey", isSubmitting: false });
    } catch {
      setStage({ name: "confirm", isSubmitting: false, hasError: true });
    }
  }, []);

  const handleSurveySubmit = useCallback(
    async (reason: string | null, otherText: string) => {
      const additionalFeedback = otherText.trim();
      if (!reason && additionalFeedback.length === 0) {
        setStage({ name: "done" });
        return;
      }
      setStage({ name: "survey", isSubmitting: true });
      try {
        await fetch("/api/subscription/cancellation-feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(reason ? { reason } : {}),
            ...(additionalFeedback ? { additionalFeedback } : {}),
          }),
        });
      } catch {
        // The survey is best-effort — never block the flow on it.
      }
      setStage({ name: "done" });
    },
    []
  );

  const stageTitle =
    stage.name === "confirm"
      ? t("confirmTitle")
      : stage.name === "survey"
        ? t("surveyTitle")
        : t("doneTitle");

  const contentClass = isMobile
    ? "top-auto bottom-0 left-0 w-full max-w-none translate-x-0 translate-y-0 rounded-t-[20px] rounded-b-none data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom"
    : "w-[460px] max-w-[calc(100vw-2rem)]";

  return (
    <Dialog onOpenChange={handleOpenChange} open={isOpen}>
      <DialogContent aria-describedby={undefined} className={contentClass}>
        <DialogTitle className="sr-only">{stageTitle}</DialogTitle>
        <div className={`${tu.body} ${isMobile ? tu.bodySheet : ""}`}>
          {isMobile && <div className={tu.grab} />}

          {stage.name === "confirm" && (
            <CancelConfirmStage
              data={data}
              hasError={stage.hasError}
              isSubmitting={stage.isSubmitting}
              onConfirm={handleConfirm}
              onKeep={() => handleOpenChange(false)}
            />
          )}

          {stage.name === "survey" && (
            <CancelSurveyStage
              isSubmitting={stage.isSubmitting}
              onSubmit={handleSurveySubmit}
            />
          )}

          {stage.name === "done" && (
            <CancelDoneStage
              data={data}
              onDone={() => handleOpenChange(false)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
