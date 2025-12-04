"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { PaymentLoadingOverlay } from "@/components/payment-loading-overlay";
import { Button } from "@/components/ui/button";
import type { PaymentStatus, PaymentStatusResponse } from "@/lib/types";

export default function PaymentStatusPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const { update: updateSession } = useSession();
  const t = useTranslations("auth.subscription");

  const [status, setStatus] = useState<PaymentStatus>("verifying");
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isTimeout, setIsTimeout] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      router.push("/subscribe");
      return;
    }

    const pollPaymentStatus = async () => {
      const maxRetries = 60; // 60 retries × 1000ms = 60 seconds

      for (let i = 0; i < maxRetries; i++) {
        try {
          const res = await fetch(
            `/api/payment/status?sessionId=${encodeURIComponent(sessionId)}`
          );

          if (!res.ok) {
            if (res.status === 429) {
              // Rate limited, wait longer
              await new Promise((resolve) => setTimeout(resolve, 2000));
              continue;
            }
            throw new Error("Failed to fetch payment status");
          }

          const data: PaymentStatusResponse = await res.json();

          // Update status
          setStatus(data.status);
          setRetryCount(i + 1);

          if (data.status === "succeeded") {
            // Success! Update session and redirect
            await updateSession({ hasActiveSubscription: true });
            sessionStorage.removeItem("payment_session_id");
            sessionStorage.removeItem("payment_expires_at");

            await new Promise((resolve) => setTimeout(resolve, 2000));
            router.push("/");
            return;
          }

          if (data.status === "failed" || data.status === "expired") {
            setError(data.failureReason || t("error"));
            return;
          }

          // Update status message after certain intervals
          if (i === 10 && status !== "activating") {
            setStatus("activating");
          }
        } catch (err) {
          console.error("Polling error:", err);
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Timeout: show manual retry
      setIsTimeout(true);
      setError(t("timeoutError"));
    };

    pollPaymentStatus();
  }, [sessionId, router, updateSession, t, status]);

  const handleRetry = () => {
    router.push(`/subscribe?sessionId=${encodeURIComponent(sessionId || "")}`);
  };

  const handleGoToSubscribe = () => {
    sessionStorage.clear();
    router.push("/subscribe");
  };

  if (!sessionId) {
    return null;
  }

  return (
    <div className="flex min-h-dvh w-screen items-center justify-center bg-background">
      <div className="flex w-full max-w-md flex-col items-center gap-6 p-8">
        <PaymentLoadingOverlay
          error={error}
          isOpen={true}
          onRetry={isTimeout ? handleRetry : undefined}
          status={status}
        />

        {isTimeout && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-center text-muted-foreground text-sm">
              {t("timeoutMessage")}
            </p>
            <div className="flex gap-2">
              <Button onClick={handleRetry} variant="outline">
                {t("retryPayment")}
              </Button>
              <Button onClick={handleGoToSubscribe} variant="ghost">
                {t("backToSubscribe")}
              </Button>
            </div>
          </div>
        )}

        {status === "verifying" && !isTimeout && (
          <p className="text-center text-muted-foreground text-sm">
            {t("extendedPolling")} ({retryCount}/60)
          </p>
        )}
      </div>
    </div>
  );
}
