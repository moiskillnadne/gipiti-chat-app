"use client";

import { HomeIcon, RotateCcwIcon } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { clientLog } from "@/lib/client-logger";
import { useTranslations } from "@/lib/i18n/translate";

type RouteErrorFallbackProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * Shared UI for route-level error boundaries (`error.tsx` files). Reports the
 * error to /api/log and renders a branded recovery screen instead of letting
 * a single failed query take down the whole app.
 */
export function RouteErrorFallback({ error, reset }: RouteErrorFallbackProps) {
  const t = useTranslations("errors");

  useEffect(() => {
    clientLog.error("Route error boundary triggered", {
      digest: error.digest,
      message: error.message,
      pathname: window.location.pathname,
    });
  }, [error]);

  return (
    <div className="flex min-h-dvh w-full flex-col bg-paper text-ink">
      <title>{`${t("boundaryMetaTitle")} | GIPITI`}</title>

      <main className="flex flex-1 flex-col items-center justify-center px-5 pb-14 sm:px-12">
        <div className="flex w-full max-w-[520px] flex-col items-center text-center">
          <div className="mb-3.5 inline-flex items-center gap-2.5 whitespace-nowrap font-medium font-mono text-[11px] text-ink-3 uppercase tracking-[0.16em]">
            <span className="h-px w-[26px] bg-rule-strong" />
            {t("boundaryEyebrow")}
            <span className="h-px w-[26px] bg-rule-strong" />
          </div>

          <h1
            className="font-light text-[clamp(28px,6vw,44px)] text-ink leading-[1.1] tracking-[-0.02em]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("boundaryTitle")}
          </h1>

          <p className="mt-4 max-w-[420px] text-[15px] text-ink-2 leading-[1.55]">
            {t("boundaryDescription")}
          </p>

          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button className="w-full sm:w-auto" onClick={reset} size="lg">
              <RotateCcwIcon />
              {t("tryAgain")}
            </Button>
            <Button
              asChild
              className="w-full sm:w-auto"
              size="lg"
              variant="outline"
            >
              <Link href="/">
                <HomeIcon />
                {t("goHome")}
              </Link>
            </Button>
          </div>

          {error.digest ? (
            <div className="mt-8 font-mono text-[10px] text-ink-4 tracking-[0.06em]">
              {t("boundaryErrorCode")}: {error.digest}
            </div>
          ) : null}
        </div>
      </main>

      <footer className="flex flex-shrink-0 justify-center px-5 pb-[26px] sm:px-12">
        <div className="inline-flex items-center gap-[7px] whitespace-nowrap font-mono text-[10px] text-ink-4 tracking-[0.06em] sm:gap-2.5 sm:text-[11px]">
          <span>HTTP 500</span>
          <span className="text-rule-strong">/</span>
          <span>SERVER ERROR</span>
          <span className="text-rule-strong">/</span>
          <span>gipiti.ru</span>
        </div>
      </footer>
    </div>
  );
}
