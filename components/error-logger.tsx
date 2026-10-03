"use client";

import { useEffect } from "react";
import { getClientDiagnostics, truncateStack } from "@/lib/client-diagnostics";
import { clientLog } from "@/lib/client-logger";

export function ErrorLogger() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      clientLog.error(`${event.message}`, {
        src: event.filename,
        line: event.lineno,
        col: event.colno,
        pathname: window.location.pathname,
        stack:
          event.error instanceof Error
            ? truncateStack(event.error.stack)
            : undefined,
        ...getClientDiagnostics(),
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      clientLog.error("Unhandled rejection", {
        reason:
          event.reason instanceof Error
            ? event.reason.message
            : String(event.reason),
        pathname: window.location.pathname,
        ...getClientDiagnostics(),
      });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
