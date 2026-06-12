import type {
  CloudPaymentsReceipt,
  CloudPaymentsWidgetOptions,
} from "@/lib/payments/cloudpayments-types";

const CLOUDPAYMENTS_SCRIPT_URL =
  "https://widget.cloudpayments.ru/bundles/cloudpayments.js";

let cloudPaymentsScriptPromise: Promise<void> | null = null;

/**
 * Load the CloudPayments widget script on demand. The script is injected
 * once per page; concurrent callers share the same promise. Rejects if
 * loading fails so the next call can retry with a fresh script tag.
 */
export function loadCloudPaymentsScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("CloudPayments widget is only available in the browser")
    );
  }

  if (window.cp) {
    return Promise.resolve();
  }

  if (cloudPaymentsScriptPromise) {
    return cloudPaymentsScriptPromise;
  }

  cloudPaymentsScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CLOUDPAYMENTS_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      cloudPaymentsScriptPromise = null;
      script.remove();
      reject(new Error("Failed to load CloudPayments widget script"));
    };
    document.head.appendChild(script);
  });

  return cloudPaymentsScriptPromise;
}

/**
 * Build a receipt for CloudPayments
 */
export function buildReceipt(
  label: string,
  amount: number,
  email: string
): CloudPaymentsReceipt {
  return {
    Items: [
      {
        label,
        price: amount,
        quantity: 1.0,
        amount,
        vat: 20,
        method: 4,
        object: 4,
      },
    ],
    taxationSystem: 0,
    email,
    isBso: false,
    amounts: {
      electronic: amount,
      advancePayment: 0,
      credit: 0,
      provision: 0,
    },
  };
}

/**
 * Create CloudPayments widget options with consistent configuration
 */
export function createWidgetOptions(email: string): CloudPaymentsWidgetOptions {
  return {
    language: "ru",
    email,
    applePaySupport: false,
    googlePaySupport: false,
    yandexPaySupport: false,
    masterPassSupport: false,
    tinkoffInstallmentSupport: false,
    loanSupport: false,
    dolyameSupport: false,
    mirPaySupport: true,
    speiSupport: false,
    cashSupport: false,
    cardInstallmentSupport: false,
    foreignSupport: false,
    sbpSupport: false,
    sberPaySupport: false,
    tinkoffPaySupport: false,
  };
}
