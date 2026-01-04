import type { Locale } from "@/i18n/config";
import type {
  CloudPaymentsReceipt,
  CloudPaymentsWidgetOptions,
} from "@/lib/payments/cloudpayments-types";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription/subscription-tiers";
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
 * Format price for display based on locale
 */
export function formatPrice(plan: PlanType, locale: Locale): string {
  const tier = SUBSCRIPTION_TIERS[plan];
  if (locale === "ru") {
    return `${tier.price.RUB.toLocaleString("ru-RU")} ₽`;
  }
  return `$${tier.price.USD}`;
}

/**
 * Get the amount for a plan in the specified currency
 */
export function getAmount(plan: PlanType, currency: Currency): number {
  const tier = SUBSCRIPTION_TIERS[plan];

  if (tier.price[currency]) {
    return tier.price[currency];
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
export function getPlanDisplayName(plan: PlanType, locale: Locale): string {
  const tier = SUBSCRIPTION_TIERS[plan];
  return tier.displayName[locale];
}

/**
 * Get the recurrent config for CloudPayments based on billing period
 */
export function getRecurrentConfig(plan: PlanType): {
  interval: "Day" | "Month";
  period: number;
} {
  const tier = SUBSCRIPTION_TIERS[plan];

  if (tier.billingPeriod === "daily") {
    return { interval: "Day", period: tier.billingPeriodCount };
  }

  if (tier.billingPeriod === "annual") {
    return { interval: "Month", period: 12 * tier.billingPeriodCount };
  }

  return { interval: "Month", period: tier.billingPeriodCount };
}

/**
 * Create CloudPayments widget options with consistent configuration
 */
export function createWidgetOptions(
  locale: Locale,
  email: string
): CloudPaymentsWidgetOptions {
  return {
    language: locale,
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
  return `${window.location.origin}/subscribe?sessionId=${encodeURIComponent(sessionId)}`;
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
}

/**
 * Get stored payment session from localStorage
 */
export function getStoredPaymentSession(): {
  sessionId: string | null;
  expiresAt: string | null;
  plan: PlanType | null;
} {
  return {
    sessionId: localStorage.getItem("payment_session_id"),
    expiresAt: localStorage.getItem("payment_expires_at"),
    plan: localStorage.getItem("payment_plan") as PlanType | null,
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
