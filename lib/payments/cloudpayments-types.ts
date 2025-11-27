export type CloudPaymentsInterval = "Day" | "Week" | "Month";

export type CloudPaymentsSubscriptionStatus =
  | "Active"
  | "PastDue"
  | "Cancelled"
  | "Rejected"
  | "Expired";

export type CloudPaymentsConfig = {
  publicId: string;
  apiSecret: string;
};

export type CloudPaymentsRecurrentParams = {
  interval: CloudPaymentsInterval;
  period: number;
  amount?: number;
  startDate?: string;
  maxPeriods?: number;
  customerReceipt?: CloudPaymentsReceipt;
};

export type CloudPaymentsReceipt = {
  Items: CloudPaymentsReceiptItem[];
  taxationSystem?: number;
  email?: string;
  phone?: string;
  isBso?: boolean;
  amounts?: {
    electronic: number;
    advancePayment?: number;
    credit?: number;
    provision?: number;
  };
};

export type CloudPaymentsReceiptItem = {
  label: string;
  price: number;
  quantity: number;
  amount: number;
  vat: number;
  method?: number;
  object?: number;
};

export type CloudPaymentsPaymentOptions = {
  publicId: string;
  description: string;
  amount: number;
  currency: string;
  accountId: string;
  invoiceId?: string;
  email?: string;
  skin?: "mini" | "modern" | "classic";
  autoClose?: number;
  data?: {
    CloudPayments?: {
      CustomerReceipt?: CloudPaymentsReceipt;
      recurrent?: CloudPaymentsRecurrentParams;
    };
    [key: string]: unknown;
  };
};

export type CloudPaymentsWidgetResult = {
  success: boolean;
  transactionId?: number;
  reason?: string;
};

export type CloudPaymentsSubscription = {
  Id: string;
  AccountId: string;
  Description: string | null;
  Email: string | null;
  Amount: number;
  CurrencyCode: number;
  Currency: string;
  RequireConfirmation: boolean;
  StartDate: string;
  StartDateIso: string;
  IntervalCode: number;
  Interval: CloudPaymentsInterval;
  Period: number;
  MaxPeriods: number | null;
  CultureName: string;
  StatusCode: number;
  Status: CloudPaymentsSubscriptionStatus;
  SuccessfulTransactionsNumber: number;
  FailedTransactionsNumber: number;
  LastTransactionDate: string | null;
  LastTransactionDateIso: string | null;
  NextTransactionDate: string | null;
  NextTransactionDateIso: string | null;
  Receipt: CloudPaymentsReceipt | null;
  FailoverSchemeId: string | null;
};

export type CloudPaymentsApiResponse<T> = {
  Model: T;
  Success: boolean;
  Message: string | null;
};

export type CloudPaymentsWebhookPayload = {
  TransactionId: number;
  Amount: number;
  Currency: string;
  DateTime: string;
  CardFirstSix: string;
  CardLastFour: string;
  CardType: string;
  CardExpDate: string;
  TestMode: boolean;
  Status: string;
  OperationType: string;
  InvoiceId?: string;
  AccountId?: string;
  SubscriptionId?: string;
  Token?: string;
  Name?: string;
  Email?: string;
  IpAddress?: string;
  IpCountry?: string;
  IpCity?: string;
  IpRegion?: string;
  IpLatitude?: string;
  IpLongitude?: string;
  Description?: string;
  Data?: string;
  Reason?: string;
  ReasonCode?: number;
};

export type CloudPaymentsCheckWebhook = CloudPaymentsWebhookPayload;
export type CloudPaymentsPayWebhook = CloudPaymentsWebhookPayload;
export type CloudPaymentsFailWebhook = CloudPaymentsWebhookPayload;
export type CloudPaymentsRecurrentWebhook = CloudPaymentsWebhookPayload & {
  Id: string;
  SuccessfulTransactionsNumber: number;
  FailedTransactionsNumber: number;
  StatusCode: number;
};
export type CloudPaymentsCancelWebhook = {
  Id: string;
  AccountId: string;
};

export type CloudPaymentsWebhookResponse = {
  code: number;
};

declare global {
  interface Window {
    cp: {
      CloudPayments: new () => CloudPaymentsWidget;
    };
  }
}

export type CloudPaymentsWidget = {
  pay: (
    scheme: "auth" | "charge",
    options: CloudPaymentsPaymentOptions,
    callbacks: {
      onSuccess?: (options: CloudPaymentsPaymentOptions) => void;
      onFail?: (reason: string, options: CloudPaymentsPaymentOptions) => void;
      onComplete?: (
        paymentResult: CloudPaymentsWidgetResult,
        options: CloudPaymentsPaymentOptions
      ) => void;
    }
  ) => void;
  charge: (
    options: CloudPaymentsPaymentOptions,
    onSuccess?: (options: CloudPaymentsPaymentOptions) => void,
    onFail?: (reason: string, options: CloudPaymentsPaymentOptions) => void
  ) => void;
  auth: (
    options: CloudPaymentsPaymentOptions,
    onSuccess?: (options: CloudPaymentsPaymentOptions) => void,
    onFail?: (reason: string, options: CloudPaymentsPaymentOptions) => void
  ) => void;
};

export type CreateSubscriptionParams = {
  token: string;
  accountId: string;
  description: string;
  email?: string;
  amount: number;
  currency: string;
  requireConfirmation: boolean;
  startDate: string;
  interval: CloudPaymentsInterval;
  period: number;
  maxPeriods?: number;
  customerReceipt?: CloudPaymentsReceipt;
};
