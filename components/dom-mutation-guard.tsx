"use client";

import { getClientDiagnostics } from "@/lib/client-diagnostics";
import { clientLog } from "@/lib/client-logger";
import {
  type DomMutationOperation,
  installDomMutationGuard,
} from "@/lib/dom/dom-mutation-guard";

let hasReportedMismatch = false;

/** Report the first prevented crash per page load; later ones add no signal. */
const reportMismatch = (operation: DomMutationOperation): void => {
  if (hasReportedMismatch) {
    return;
  }
  hasReportedMismatch = true;
  clientLog.info("DOM mutation guard prevented crash", {
    operation,
    pathname: window.location.pathname,
    ...getClientDiagnostics(),
  });
};

// Installed at module evaluation so the patch is in place before hydration.
if (typeof window !== "undefined") {
  installDomMutationGuard(reportMismatch);
}

/**
 * Keeps page translators from crashing React commits — see
 * `installDomMutationGuard`. Mounted once in the root layout; renders nothing.
 */
export const DomMutationGuard = (): null => null;
