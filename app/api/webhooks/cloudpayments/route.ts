import { getCloudPaymentsConfig } from "@/server/integrations/cloudpayments/cloudpayments-config";
import type {
  CloudPaymentsCancelWebhook,
  CloudPaymentsCheckWebhook,
  CloudPaymentsFailWebhook,
  CloudPaymentsPayWebhook,
  CloudPaymentsRefundWebhook,
} from "@/server/integrations/cloudpayments/cloudpayments-types";
import { handleCancelWebhook } from "@/server/webhooks/cloudpayments/handlers/cancel";
import { handleCheckWebhook } from "@/server/webhooks/cloudpayments/handlers/check";
import { handleFailWebhook } from "@/server/webhooks/cloudpayments/handlers/fail";
import { handlePayWebhook } from "@/server/webhooks/cloudpayments/handlers/pay";
import { handleRecurrentWebhook } from "@/server/webhooks/cloudpayments/handlers/recurrent";
import { handleRefundWebhook } from "@/server/webhooks/cloudpayments/handlers/refund";
import { normalizeRecurrentPayload } from "@/server/webhooks/cloudpayments/recurrent-normalizer";
import { isValidWebhookSignature } from "@/server/webhooks/cloudpayments/signature";

// CloudPayments has a 30s timeout for webhooks.
// Ensure Vercel allocates enough time (especially for cold starts + DB queries).
export const maxDuration = 25;

type WebhookType = "check" | "pay" | "fail" | "recurrent" | "cancel" | "refund";

function getWebhookType(request: Request): WebhookType | null {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  if (
    type === "check" ||
    type === "pay" ||
    type === "fail" ||
    type === "recurrent" ||
    type === "cancel" ||
    type === "refund"
  ) {
    return type;
  }
  return null;
}

export async function POST(request: Request): Promise<Response> {
  const webhookType = getWebhookType(request);

  if (!webhookType) {
    return Response.json(
      { error: "Missing or invalid webhook type" },
      { status: 400 }
    );
  }

  console.info(`[CloudPayments] Received webhook of type ${webhookType}`);

  const rawBody = await request.text();
  const signature = request.headers.get("Content-HMAC");

  // The config is read only once a signature is present, as before: a request
  // without the header is refused even when the secret is not configured.
  const isSignatureValid =
    signature !== null &&
    isValidWebhookSignature(
      rawBody,
      signature,
      getCloudPaymentsConfig().apiSecret
    );

  if (!isSignatureValid) {
    console.error("[CloudPayments] Invalid webhook signature");
    return Response.json({ code: 13 }, { status: 401 });
  }

  let payload: unknown;
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams(rawBody);
      payload = Object.fromEntries(params.entries());
    } else {
      payload = JSON.parse(rawBody);
    }
  } catch (error) {
    console.error("[CloudPayments] Error parsing webhook payload:", error);
    return Response.json({ code: 13 });
  }

  switch (webhookType) {
    case "check":
      return await handleCheckWebhook(payload as CloudPaymentsCheckWebhook);
    case "pay":
      return handlePayWebhook(payload as CloudPaymentsPayWebhook);
    case "fail":
      return handleFailWebhook(payload as CloudPaymentsFailWebhook);
    case "recurrent": {
      // Ensure required fields are present and types are normalized before handing off to the recurrent handler.
      const normalized = normalizeRecurrentPayload(payload);

      if (!normalized) {
        return Response.json({ code: 13 }, { status: 400 });
      }

      return handleRecurrentWebhook(normalized);
    }
    case "cancel":
      return handleCancelWebhook(payload as CloudPaymentsCancelWebhook);
    case "refund":
      return handleRefundWebhook(payload as CloudPaymentsRefundWebhook);
    default:
      return Response.json({ code: 0 });
  }
}
