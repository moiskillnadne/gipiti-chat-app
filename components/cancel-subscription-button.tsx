"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type CancelSubscriptionButtonProps = {
  currentPeriodEnd: Date;
  isAlreadyCancelled: boolean;
  isTrial?: boolean;
};

export function CancelSubscriptionButton({
  currentPeriodEnd,
  isAlreadyCancelled,
  isTrial = false,
}: CancelSubscriptionButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
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

  const handleCancel = async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/subscription", {
        method: "DELETE",
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
        setIsOpen(false);
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

  return (
    <AlertDialog onOpenChange={setIsOpen} open={isOpen}>
      <AlertDialogTrigger asChild>
        <Button
          disabled={isAlreadyCancelled || isLoading}
          variant="destructive"
        >
          {t("cancelButton")}
        </Button>
      </AlertDialogTrigger>
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
  );
}
