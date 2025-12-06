import crypto from "node:crypto";
import { getCloudPaymentsConfig } from "@/lib/payments/cloudpayments-config";
import type {
  CloudPaymentsCancelWebhook,
  CloudPaymentsCheckWebhook,
  CloudPaymentsFailWebhook,
  CloudPaymentsPayWebhook,
} from "@/lib/payments/cloudpayments-types";
import { handleCancelWebhook } from "./lib/handlers/cancel";
import { handleCheckWebhook } from "./lib/handlers/check";
import { handleFailWebhook } from "./lib/handlers/fail";
import { handlePayWebhook } from "./lib/handlers/pay";
import { handleRecurrentWebhook } from "./lib/handlers/recurrent";
import { normalizeRecurrentPayload } from "./lib/recurrent-normalizer";

type WebhookType = "check" | "pay" | "fail" | "recurrent" | "cancel";

function validateWebhookSignature(
  body: string,
  signature: string | null
): boolean {
  if (!signature) {
    return false;
  }

  const config = getCloudPaymentsConfig();
  const hmac = crypto.createHmac("sha256", config.apiSecret);
  hmac.update(body);
  const expectedSignature = hmac.digest("base64");
  return signature === expectedSignature;
}

function getWebhookType(request: Request): WebhookType | null {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  if (
    type === "check" ||
    type === "pay" ||
    type === "fail" ||
    type === "recurrent" ||
    type === "cancel"
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

  if (!validateWebhookSignature(rawBody, signature)) {
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
    default:
      return Response.json({ code: 0 });
  }
}
