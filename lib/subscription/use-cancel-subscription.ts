"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/components/toast";
import { useTranslations } from "@/lib/i18n/translate";

export type CancelSubscriptionFeedback = {
  reasons: string[];
  additionalFeedback: string;
};

type UseCancelSubscriptionParams = {
  currentPeriodEnd: Date;
  isTrial: boolean;
};

export type UseCancelSubscriptionReturn = {
  isFeedbackOpen: boolean;
  isConfirmOpen: boolean;
  isLoading: boolean;
  openFeedback: () => void;
  closeFeedback: () => void;
  closeConfirm: () => void;
  submitFeedback: (data: CancelSubscriptionFeedback) => void;
  confirmCancel: () => Promise<void>;
};

const FORMAT_RU_DATE = new Intl.DateTimeFormat("ru-RU", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

export function useCancelSubscription({
  currentPeriodEnd,
  isTrial,
}: UseCancelSubscriptionParams): UseCancelSubscriptionReturn {
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [feedbackData, setFeedbackData] =
    useState<CancelSubscriptionFeedback | null>(null);
  const router = useRouter();
  const t = useTranslations("auth.subscription.management.dangerZone");

  const openFeedback = () => setIsFeedbackOpen(true);
  const closeFeedback = () => setIsFeedbackOpen(false);

  const closeConfirm = () => {
    setIsConfirmOpen(false);
    setFeedbackData(null);
  };

  const submitFeedback = (data: CancelSubscriptionFeedback) => {
    setFeedbackData(data);
    setIsFeedbackOpen(false);
    setIsConfirmOpen(true);
  };

  const confirmCancel = async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/subscription", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: feedbackData }),
      });

      if (!response.ok) {
        toast({ type: "error", description: t("cancelError") });
        return;
      }

      if (isTrial) {
        toast({ type: "success", description: t("cancelSuccessTrial") });
      } else {
        const formattedDate = FORMAT_RU_DATE.format(currentPeriodEnd);
        toast({
          type: "success",
          description: t("cancelSuccess", { date: formattedDate }),
        });
      }

      setIsConfirmOpen(false);
      setFeedbackData(null);
      router.refresh();
    } catch {
      toast({ type: "error", description: t("cancelError") });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isFeedbackOpen,
    isConfirmOpen,
    isLoading,
    openFeedback,
    closeFeedback,
    closeConfirm,
    submitFeedback,
    confirmCancel,
  };
}
