import type {
  CloudPaymentsReceipt,
  CloudPaymentsWidgetOptions,
} from "@/lib/payments/cloudpayments-types";

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
