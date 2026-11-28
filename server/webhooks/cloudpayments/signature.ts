import crypto from "node:crypto";

/**
 * Check the `Content-HMAC` header CloudPayments sends with every webhook: the
 * base64 HMAC-SHA256 of the raw request body, keyed with the API secret.
 *
 * Both values are compared as decoded bytes in constant time, so the response
 * time does not reveal how many leading characters of a forged signature were
 * right. `timingSafeEqual` throws on buffers of different length, hence the
 * length check first (the length of a SHA-256 digest is not a secret).
 */
export const isValidWebhookSignature = (
  body: string,
  signature: string | null,
  apiSecret: string
): boolean => {
  if (!signature) {
    return false;
  }

  const expectedDigest = crypto
    .createHmac("sha256", apiSecret)
    .update(body)
    .digest();
  const providedDigest = Buffer.from(signature, "base64");

  if (providedDigest.length !== expectedDigest.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedDigest, expectedDigest);
};
