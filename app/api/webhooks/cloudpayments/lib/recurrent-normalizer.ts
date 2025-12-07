import type { CloudPaymentsRecurrentWebhook } from "@/lib/payments/cloudpayments-types";
import { toNumber } from "./handlers/utils";

const toBoolean = (value: unknown): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value === "true" || value === "1";
  }

  return false;
};

const toStringOrUndefined = (value: unknown): string | undefined => {
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }

  return;
};

const toStringOrEmpty = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }

  return "";
};

export const normalizeRecurrentPayload = (
  rawPayload: unknown
): CloudPaymentsRecurrentWebhook | null => {
  if (!rawPayload || typeof rawPayload !== "object") {
    return null;
  }

  const payload = rawPayload as Record<string, unknown>;
  const status =
    typeof payload.Status === "string"
      ? (payload.Status as CloudPaymentsRecurrentWebhook["Status"])
      : null;
  const subscriptionId = toStringOrUndefined(payload.Id);

  if (!status || !subscriptionId) {
    return null;
  }

  const amount = toNumber(payload.Amount);

  return {
    TransactionId: toNumber(payload.TransactionId) ?? 0,
    Amount: amount ?? 0,
    Currency: toStringOrEmpty(payload.Currency),
    DateTime: toStringOrEmpty(payload.DateTime),
    CardFirstSix: toStringOrEmpty(payload.CardFirstSix),
    CardLastFour: toStringOrEmpty(payload.CardLastFour),
    CardType: toStringOrEmpty(payload.CardType),
    CardExpDate: toStringOrEmpty(payload.CardExpDate),
    TestMode: toBoolean(payload.TestMode),
    StatusCode: toNumber(payload.StatusCode) ?? 0,
    Status: status,
    OperationType: toStringOrEmpty(payload.OperationType),
    InvoiceId: toStringOrUndefined(payload.InvoiceId),
    AccountId: toStringOrUndefined(payload.AccountId),
    SubscriptionId: toStringOrUndefined(payload.SubscriptionId),
    Token: toStringOrUndefined(payload.Token),
    Name: toStringOrUndefined(payload.Name),
    Email: toStringOrUndefined(payload.Email),
    IpAddress: toStringOrUndefined(payload.IpAddress),
    IpCountry: toStringOrUndefined(payload.IpCountry),
    IpCity: toStringOrUndefined(payload.IpCity),
    IpRegion: toStringOrUndefined(payload.IpRegion),
    IpLatitude: toStringOrUndefined(payload.IpLatitude),
    IpLongitude: toStringOrUndefined(payload.IpLongitude),
    Description: toStringOrUndefined(payload.Description),
    Data: toStringOrUndefined(payload.Data),
    Reason: toStringOrUndefined(payload.Reason),
    ReasonCode: toNumber(payload.ReasonCode) ?? undefined,
    Id: subscriptionId,
    SuccessfulTransactionsNumber:
      toNumber(payload.SuccessfulTransactionsNumber) ?? 0,
    FailedTransactionsNumber: toNumber(payload.FailedTransactionsNumber) ?? 0,
  };
};
