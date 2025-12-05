"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Suspense, useEffect, useState } from "react";
import { PaymentLoadingOverlay } from "@/components/payment-loading-overlay";
import { Button } from "@/components/ui/button";
import type { PaymentStatus, PaymentStatusResponse } from "@/lib/types";

export default function PaymentStatusPage() {
  return (
    <Suspense fallback={<PaymentStatusFallback />}>
      <PaymentStatusContent />
    </Suspense>
  );
}

function PaymentStatusFallback() {
  return (
    <div className="flex min-h-dvh w-screen items-center justify-center bg-background">
      <div className="flex w-full max-w-md flex-col items-center gap-6 p-8">
        <PaymentLoadingOverlay error={null} isOpen={true} status="verifying" />
      </div>
    </div>
  );
}

function PaymentStatusContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { update: updateSession } = useSession();
  const t = useTranslations("auth.subscription");

  const [status, setStatus] = useState<PaymentStatus>("verifying");
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isTimeout, setIsTimeout] = useState(false);
  const [resolvedSessionId, setResolvedSessionId] = useState<string | null>(
    null
  );

  useEffect(() => {
    let sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      sessionId = localStorage.getItem("payment_session_id");
    }

    if (!sessionId) {
      router.push("/subscribe");
      return;
    }

    const expiresAt = localStorage.getItem("payment_expires_at");
    if (expiresAt && new Date(expiresAt) < new Date()) {
      localStorage.removeItem("payment_session_id");
      localStorage.removeItem("payment_expires_at");
      router.push("/subscribe");
      return;
    }

    setResolvedSessionId(sessionId);

    const pollPaymentStatus = async (sid: string) => {
      const maxRetries = 60; // 60 retries × 1000ms = 60 seconds

      for (let i = 0; i < maxRetries; i++) {
        try {
          const res = await fetch(
            `/api/payment/status?sessionId=${encodeURIComponent(sid)}`
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
            localStorage.removeItem("payment_session_id");
            localStorage.removeItem("payment_expires_at");

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

    pollPaymentStatus(sessionId);
  }, [searchParams, router, updateSession, t, status]);

  const handleRetry = () => {
    router.push(
      `/subscribe?sessionId=${encodeURIComponent(resolvedSessionId || "")}`
    );
  };

  const handleGoToSubscribe = () => {
    localStorage.removeItem("payment_session_id");
    localStorage.removeItem("payment_expires_at");
    router.push("/subscribe");
  };

  if (!resolvedSessionId) {
    return <PaymentStatusFallback />;
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
