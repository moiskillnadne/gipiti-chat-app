"use client";

import { useEffect } from "react";
import { clientLog } from "@/lib/client-logger";

export function ErrorLogger() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      clientLog.error(`${event.message}`, {
        src: event.filename,
        line: event.lineno,
        col: event.colno,
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      clientLog.error("Unhandled rejection", {
        reason:
          event.reason instanceof Error
            ? event.reason.message
            : String(event.reason),
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

