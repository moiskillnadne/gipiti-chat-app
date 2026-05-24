import { ChatSDKError } from "@/lib/errors";

const GATEWAY_CREDIT_CARD_ERROR =
  "AI Gateway requires a valid credit card on file to service requests";

/**
 * Map an unhandled POST error to a Response: ChatSDKError passes through, the
 * AI Gateway "needs a credit card" error maps to a dedicated code, and anything
 * else is logged with the Vercel request id and surfaced as offline.
 */
export function handleChatError(error: unknown, request: Request): Response {
  if (error instanceof ChatSDKError) {
    return error.toResponse();
  }

  if (
    error instanceof Error &&
    error.message?.includes(GATEWAY_CREDIT_CARD_ERROR)
  ) {
    return new ChatSDKError("bad_request:activate_gateway").toResponse();
  }

  const vercelId = request.headers.get("x-vercel-id");
  console.error("Unhandled error in chat API:", error, { vercelId });
  return new ChatSDKError("offline:chat").toResponse();
}
