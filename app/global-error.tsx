"use client";

import { useEffect } from "react";

import { clientLog } from "@/lib/client-logger";
import { useTranslations } from "@/lib/i18n/translate";

// Renders when the root layout itself fails, so globals.css is unavailable —
// styles must stay inline and the markup must provide its own <html>/<body>.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    clientLog.error("Global error boundary triggered", {
      digest: error.digest,
      message: error.message,
      pathname: window.location.pathname,
    });
  }, [error]);

  return (
    <html lang="ru">
      <body
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          fontFamily: "system-ui, sans-serif",
          backgroundColor: "#0a0a0a",
          color: "#fafafa",
          margin: 0,
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
            {t("boundaryTitle")}
          </h2>
          <p
            style={{
              color: "#a1a1aa",
              marginBottom: "1.5rem",
              maxWidth: "400px",
            }}
          >
            {t("boundaryDescription")}
          </p>
          <button
            onClick={reset}
            style={{
              padding: "0.625rem 1.25rem",
              backgroundColor: "#fafafa",
              color: "#0a0a0a",
              border: "none",
              borderRadius: "0.5rem",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
            type="button"
          >
            {t("tryAgain")}
          </button>
        </div>
      </body>
    </html>
  );
}
