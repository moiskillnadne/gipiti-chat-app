"use client";

import { useTranslations } from "next-intl";
import { Loader } from "@/components/elements/loader";

export type PaymentStatus =
  | "processing"
  | "verifying"
  | "activating"
  | "success";

type PaymentLoadingOverlayProps = {
  isOpen: boolean;
  status: PaymentStatus | null;
};

const statusMessageKeys: Record<PaymentStatus, string> = {
  processing: "processing",
  verifying: "verifying",
  activating: "activating",
  success: "successRedirect",
};

export function PaymentLoadingOverlay({
  isOpen,
  status,
}: PaymentLoadingOverlayProps) {
  const t = useTranslations("auth.subscription");

  if (!isOpen || !status) {
    return null;
  }

  const messageKey = statusMessageKeys[status];

  return (
    <div
      aria-labelledby="payment-status"
      aria-modal="true"
      className="fade-in fixed inset-0 z-50 flex animate-in items-center justify-center bg-black/50 backdrop-blur-sm duration-200"
      role="dialog"
    >
      <div className="zoom-in-95 flex animate-in flex-col items-center gap-6 rounded-lg border bg-background p-8 shadow-lg duration-200">
        <Loader size={26} />
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="font-medium text-lg" id="payment-status">
            {t(messageKey)}
          </p>
          <p className="max-w-xs text-muted-foreground text-sm">
            {t("pleaseWait")}
          </p>
        </div>
      </div>
    </div>
  );
}
