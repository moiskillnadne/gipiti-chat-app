"use client";

import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Loader } from "@/components/elements/loader";
import { Button } from "@/components/ui/button";
import type { PaymentStatus } from "@/lib/types";

type PaymentLoadingOverlayProps = {
  isOpen: boolean;
  status: PaymentStatus | null;
  error?: string | null;
  onRetry?: () => void;
};

const statusMessageKeys: Record<PaymentStatus, string> = {
  pending: "processing",
  processing: "processing",
  verifying: "verifying",
  activating: "activating",
  succeeded: "successRedirect",
  failed: "failed",
  expired: "expired",
};

export function PaymentLoadingOverlay({
  isOpen,
  status,
  error,
  onRetry,
}: PaymentLoadingOverlayProps) {
  const t = useTranslations("auth.subscription");

  if (!isOpen || !status) {
    return null;
  }

  const messageKey = statusMessageKeys[status];
  const isLoading =
    status === "pending" ||
    status === "processing" ||
    status === "verifying" ||
    status === "activating";
  const isSuccess = status === "succeeded";
  const isError = status === "failed" || status === "expired";

  return (
    <div
      aria-labelledby="payment-status"
      aria-modal="true"
      className="fade-in fixed inset-0 z-50 flex animate-in items-center justify-center bg-black/50 backdrop-blur-sm duration-200"
      role="dialog"
    >
      <div className="zoom-in-95 flex animate-in flex-col items-center gap-6 rounded-lg border bg-background p-8 shadow-lg duration-200">
        {/* Icon based on status */}
        {isLoading && <Loader size={26} />}
        {isSuccess && (
          <CheckCircle2 aria-hidden="true" className="size-8 text-green-500" />
        )}
        {isError && (
          <XCircle aria-hidden="true" className="size-8 text-red-500" />
        )}

        <div className="flex flex-col items-center gap-2 text-center">
          <p className="font-medium text-lg" id="payment-status">
            {t(messageKey)}
          </p>

          {/* Show wait message for loading states */}
          {isLoading && (
            <p className="max-w-xs text-muted-foreground text-sm">
              {t("pleaseWait")}
            </p>
          )}

          {/* Show error message if provided */}
          {isError && error && (
            <div className="mt-2 flex items-start gap-2 rounded-md bg-destructive/10 p-3">
              <AlertCircle
                aria-hidden="true"
                className="size-4 text-destructive"
              />
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}

          {/* Show retry button for errors */}
          {isError && onRetry && (
            <Button className="mt-4" onClick={onRetry} variant="outline">
              {t("retryPayment")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
