"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { CancellationFeedbackDialog } from "@/components/cancellation-feedback-dialog";
import { toast } from "@/components/toast";
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
import { Button } from "@/components/ui/button";

type CancelSubscriptionButtonProps = {
  currentPeriodEnd: Date;
  isAlreadyCancelled: boolean;
  isTrial?: boolean;
};

type FeedbackData = {
  reasons: string[];
  additionalFeedback: string;
};

export function CancelSubscriptionButton({
  currentPeriodEnd,
  isAlreadyCancelled,
  isTrial = false,
}: CancelSubscriptionButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [feedbackData, setFeedbackData] = useState<FeedbackData | null>(null);
  const router = useRouter();
  const t = useTranslations("auth.subscription.management.dangerZone");
  const tCommon = useTranslations("common.buttons");

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("ru-RU", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(date));
  };

  const handleFeedbackSubmit = (data: FeedbackData) => {
    setFeedbackData(data);
    setIsFeedbackOpen(false);
    setIsConfirmOpen(true);
  };

  const handleCancel = async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/subscription", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          feedback: feedbackData,
        }),
      });

      if (response.ok) {
        if (isTrial) {
          toast({
            type: "success",
            description: t("cancelSuccessTrial"),
          });
        } else {
          const formattedDate = formatDate(currentPeriodEnd);
          toast({
            type: "success",
            description: t("cancelSuccess", { date: formattedDate }),
          });
        }
        setIsConfirmOpen(false);
        setFeedbackData(null);
        router.refresh();
      } else {
        toast({
          type: "error",
          description: t("cancelError"),
        });
      }
    } catch {
      toast({
        type: "error",
        description: t("cancelError"),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmClose = () => {
    setIsConfirmOpen(false);
    setFeedbackData(null);
  };

  return (
    <>
      <Button
        disabled={isAlreadyCancelled || isLoading}
        onClick={() => setIsFeedbackOpen(true)}
        variant="destructive"
      >
        {t("cancelButton")}
      </Button>

      <CancellationFeedbackDialog
        isLoading={isLoading}
        isOpen={isFeedbackOpen}
        isTrial={isTrial}
        onOpenChange={setIsFeedbackOpen}
        onSubmit={handleFeedbackSubmit}
      />

      <AlertDialog onOpenChange={handleConfirmClose} open={isConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isTrial ? t("confirmTitleTrial") : t("confirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isTrial
                ? t("confirmDescriptionTrial")
                : t("confirmDescription", {
                    date: formatDate(currentPeriodEnd),
                  })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>
              {tCommon("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isLoading}
              onClick={(e) => {
                e.preventDefault();
                handleCancel();
              }}
            >
              {isLoading ? t("cancelling") : t("confirmButton")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
