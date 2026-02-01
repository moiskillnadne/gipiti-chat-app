"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CANCELLATION_REASONS,
  type CancellationReasonCode,
  MIN_FEEDBACK_LENGTH,
  REASON_TRANSLATION_KEYS,
} from "@/lib/subscription/cancellation-reasons";

type CancellationFeedbackDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { reasons: string[]; additionalFeedback: string }) => void;
  isLoading: boolean;
  isTrial: boolean;
};

export function CancellationFeedbackDialog({
  isOpen,
  onOpenChange,
  onSubmit,
  isLoading,
  isTrial,
}: CancellationFeedbackDialogProps) {
  const t = useTranslations("auth.subscription.management.dangerZone.feedback");

  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [additionalFeedback, setAdditionalFeedback] = useState("");

  const isValid =
    selectedReasons.length > 0 ||
    additionalFeedback.trim().length >= MIN_FEEDBACK_LENGTH;

  const handleReasonToggle = (reasonCode: string) => {
    setSelectedReasons((prev) =>
      prev.includes(reasonCode)
        ? prev.filter((r) => r !== reasonCode)
        : [...prev, reasonCode]
    );
  };

  const handleSubmit = () => {
    if (isValid) {
      onSubmit({
        reasons: selectedReasons,
        additionalFeedback: additionalFeedback.trim(),
      });
    }
  };

  const handleClose = () => {
    setSelectedReasons([]);
    setAdditionalFeedback("");
    onOpenChange(false);
  };

  return (
    <AlertDialog onOpenChange={handleClose} open={isOpen}>
      <AlertDialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isTrial ? t("titleTrial") : t("title")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isTrial ? t("descriptionTrial") : t("description")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            {Object.values(CANCELLATION_REASONS).map((code) => {
              const translationKey =
                REASON_TRANSLATION_KEYS[code as CancellationReasonCode];
              return (
                <div className="flex items-center space-x-3" key={code}>
                  <Checkbox
                    checked={selectedReasons.includes(code)}
                    id={code}
                    onCheckedChange={() => handleReasonToggle(code)}
                  />
                  <Label
                    className="cursor-pointer font-normal text-sm leading-snug"
                    htmlFor={code}
                  >
                    {t(`reasons.${translationKey}`)}
                  </Label>
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            <Label htmlFor="additional-feedback">
              {t("additionalFeedbackLabel")}
            </Label>
            <Textarea
              className="min-h-[100px] resize-none"
              id="additional-feedback"
              onChange={(e) => setAdditionalFeedback(e.target.value)}
              placeholder={t("additionalFeedbackPlaceholder")}
              value={additionalFeedback}
            />
          </div>

          {!isValid && (
            <p className="text-muted-foreground text-sm">
              {t("validation.selectOrWrite")}
            </p>
          )}
        </div>

        <AlertDialogFooter>
          <Button disabled={isLoading} onClick={handleClose} variant="outline">
            {t("backButton")}
          </Button>
          <Button
            disabled={!isValid || isLoading}
            onClick={handleSubmit}
            variant="destructive"
          >
            {t("continueButton")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
