import {
  CLOUDPAYMENTS_API_URL,
  getCloudPaymentsConfig,
} from "./cloudpayments-config";
import type {
  CloudPaymentsApiResponse,
  CloudPaymentsSubscription,
  CreateSubscriptionParams,
} from "./cloudpayments-types";

function getAuthHeader(): string {
  const config = getCloudPaymentsConfig();
  const credentials = Buffer.from(
    `${config.publicId}:${config.apiSecret}`
  ).toString("base64");
  return `Basic ${credentials}`;
}

async function cloudPaymentsRequest<T>(
  endpoint: string,
  body: Record<string, unknown>
): Promise<CloudPaymentsApiResponse<T>> {
  const response = await fetch(`${CLOUDPAYMENTS_API_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`CloudPayments API error: ${response.status}`);
  }

  return response.json();
}

export async function createSubscription(
  params: CreateSubscriptionParams
): Promise<CloudPaymentsApiResponse<CloudPaymentsSubscription>> {
  return await cloudPaymentsRequest<CloudPaymentsSubscription>(
    "/subscriptions/create",
    {
      Token: params.token,
      AccountId: params.accountId,
      Description: params.description,
      Email: params.email,
      Amount: params.amount,
      Currency: params.currency,
      RequireConfirmation: params.requireConfirmation,
      StartDate: params.startDate,
      Interval: params.interval,
      Period: params.period,
      MaxPeriods: params.maxPeriods,
      CustomerReceipt: params.customerReceipt,
    }
  );
}

export async function getSubscription(
  subscriptionId: string
): Promise<CloudPaymentsApiResponse<CloudPaymentsSubscription>> {
  return await cloudPaymentsRequest<CloudPaymentsSubscription>(
    "/subscriptions/get",
    {
      Id: subscriptionId,
    }
  );
}

export async function findSubscriptions(
  accountId: string
): Promise<CloudPaymentsApiResponse<CloudPaymentsSubscription[]>> {
  return await cloudPaymentsRequest<CloudPaymentsSubscription[]>(
    "/subscriptions/find",
    { accountId }
  );
}

export async function updateSubscription(
  subscriptionId: string,
  updates: {
    description?: string;
    amount?: number;
    currency?: string;
    requireConfirmation?: boolean;
    startDate?: string;
    interval?: string;
    period?: number;
    maxPeriods?: number;
  }
): Promise<CloudPaymentsApiResponse<CloudPaymentsSubscription>> {
  return await cloudPaymentsRequest<CloudPaymentsSubscription>(
    "/subscriptions/update",
    {
      Id: subscriptionId,
      Description: updates.description,
      Amount: updates.amount,
      Currency: updates.currency,
      RequireConfirmation: updates.requireConfirmation,
      StartDate: updates.startDate,
      Interval: updates.interval,
      Period: updates.period,
      MaxPeriods: updates.maxPeriods,
    }
  );
}

export async function cancelSubscription(
  subscriptionId: string
): Promise<CloudPaymentsApiResponse<null>> {
  return await cloudPaymentsRequest<null>("/subscriptions/cancel", {
    Id: subscriptionId,
  });
}

export async function chargeByToken(params: {
  amount: number;
  currency: string;
  accountId: string;
  token: string;
  description: string;
  invoiceId?: string;
  email?: string;
}): Promise<
  CloudPaymentsApiResponse<{
    TransactionId: number;
    Amount: number;
    Currency: string;
    Status: string;
  }>
> {
  return await cloudPaymentsRequest("/payments/tokens/charge", {
    Amount: params.amount,
    Currency: params.currency,
    AccountId: params.accountId,
    Token: params.token,
    Description: params.description,
    InvoiceId: params.invoiceId,
    Email: params.email,
  });
}
