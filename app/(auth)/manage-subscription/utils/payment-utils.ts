import type {
  CloudPaymentsReceipt,
  CloudPaymentsWidgetOptions,
} from "@/lib/payments/cloudpayments-types";
import { getSubscriptionSeedByCode } from "@/lib/subscription/subscription-tiers";
import type { PlanType } from "../hooks/payment-reducer";

export type Currency = "RUB" | "USD";

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
 * Format price for display (always RUB)
 */
export function formatPrice(plan: PlanType): string {
  const seed = getSubscriptionSeedByCode(plan);
  return `${(seed?.prices.RUB ?? 0).toLocaleString("ru-RU")} ₽`;
}

/**
 * Split the RUB price into amount and currency parts for the styled
 * price display (large numeral + smaller currency glyph).
 */
export function getPriceParts(plan: PlanType): {
  amount: string;
  currency: string;
} {
  const seed = getSubscriptionSeedByCode(plan);
  return {
    amount: (seed?.prices.RUB ?? 0).toLocaleString("ru-RU"),
    currency: "₽",
  };
}

/**
 * Get the amount for a plan in the specified currency
 */
export function getAmount(plan: PlanType, currency: Currency): number {
  const seed = getSubscriptionSeedByCode(plan);
  const amount = seed?.prices[currency];

  if (amount != null) {
    return amount;
  }

  throw new Error(`Price for ${plan} in ${currency} is not defined`);
}

/**
 * Get the currency to use for payments
 */
export function getCurrency(): Currency {
  return "RUB";
}

/**
 * Get the display name for a plan
 */
export function getPlanDisplayName(plan: PlanType): string {
  return getSubscriptionSeedByCode(plan)?.displayName ?? plan;
}

/**
 * Get the recurrent config for CloudPayments based on billing period
 */
export function getRecurrentConfig(plan: PlanType): {
  interval: "Day" | "Month";
  period: number;
} {
  const seed = getSubscriptionSeedByCode(plan);
  const billingPeriod = seed?.billingPeriod ?? "monthly";
  const count = seed?.billingPeriodCount ?? 1;

  if (billingPeriod === "daily") {
    return { interval: "Day", period: count };
  }

  if (billingPeriod === "annual") {
    return { interval: "Month", period: 12 * count };
  }

  return { interval: "Month", period: count };
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

/**
 * Build the return URL for CloudPayments redirect recovery
 */
export function buildReturnUrl(sessionId: string): string {
  return `${window.location.origin}/manage-subscription?sessionId=${encodeURIComponent(sessionId)}`;
}

/**
 * Store payment session in localStorage for redirect recovery
 */
export function storePaymentSession(
  sessionId: string,
  expiresAt: string,
  plan: PlanType
): void {
  localStorage.setItem("payment_session_id", sessionId);
  localStorage.setItem("payment_expires_at", expiresAt);
  localStorage.setItem("payment_plan", plan);
}

/**
 * Clear payment session from localStorage
 */
export function clearPaymentSession(): void {
  localStorage.removeItem("payment_session_id");
  localStorage.removeItem("payment_expires_at");
  localStorage.removeItem("payment_plan");
  localStorage.removeItem("payment_widget_opened");
}

/**
 * Store the timestamp when widget.pay() was called.
 * This is used to distinguish between "intent created" and "widget actually opened".
 */
export function storeWidgetOpened(): void {
  localStorage.setItem("payment_widget_opened", new Date().toISOString());
}

/**
 * Check if the widget was opened (widget.pay() was called).
 * Returns the timestamp if set, null otherwise.
 */
export function getWidgetOpenedTimestamp(): string | null {
  return localStorage.getItem("payment_widget_opened");
}

/**
 * Check if the widget was opened for the current session.
 * Used to prevent false verification modals when user refreshes before widget opens.
 */
export function hasWidgetOpened(): boolean {
  return localStorage.getItem("payment_widget_opened") !== null;
}

/**
 * Get stored payment session from localStorage
 */
export function getStoredPaymentSession(): {
  sessionId: string | null;
  expiresAt: string | null;
  plan: PlanType | null;
  widgetOpened: string | null;
} {
  return {
    sessionId: localStorage.getItem("payment_session_id"),
    expiresAt: localStorage.getItem("payment_expires_at"),
    plan: localStorage.getItem("payment_plan") as PlanType | null,
    widgetOpened: localStorage.getItem("payment_widget_opened"),
  };
}

/**
 * Check if a stored payment session has expired
 */
export function isPaymentSessionExpired(expiresAt: string | null): boolean {
  if (!expiresAt) {
    return true;
  }

  return new Date(expiresAt) < new Date();
}
