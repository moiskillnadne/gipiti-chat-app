import crypto from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import { isValidWebhookSignature } from "../signature";

const API_SECRET = "test-api-secret";
const BODY = "TransactionId=1&Amount=100.00&Currency=RUB";

const sign = (body: string, secret: string = API_SECRET): string =>
  crypto.createHmac("sha256", secret).update(body).digest("base64");

describe("isValidWebhookSignature", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts the HMAC-SHA256 of the raw body", () => {
    expect(isValidWebhookSignature(BODY, sign(BODY), API_SECRET)).toBe(true);
  });

  it("rejects a signature made for a different body", () => {
    const signature = sign(`${BODY}&Amount=1.00`);

    expect(isValidWebhookSignature(BODY, signature, API_SECRET)).toBe(false);
  });

  it("rejects a signature made with a different secret", () => {
    const signature = sign(BODY, "another-secret");

    expect(isValidWebhookSignature(BODY, signature, API_SECRET)).toBe(false);
  });

  it("rejects a missing or empty signature", () => {
    expect(isValidWebhookSignature(BODY, null, API_SECRET)).toBe(false);
    expect(isValidWebhookSignature(BODY, "", API_SECRET)).toBe(false);
  });

  it("rejects a signature of the wrong length without throwing", () => {
    const truncatedSignature = Buffer.from("too-short").toString("base64");

    expect(isValidWebhookSignature(BODY, truncatedSignature, API_SECRET)).toBe(
      false
    );
  });

  it("compares a full-length forgery in constant time", () => {
    const timingSafeEqualSpy = vi.spyOn(crypto, "timingSafeEqual");
    const forgedSignature = Buffer.alloc(32, 7).toString("base64");

    const isValid = isValidWebhookSignature(BODY, forgedSignature, API_SECRET);

    expect(isValid).toBe(false);
    expect(timingSafeEqualSpy).toHaveBeenCalledTimes(1);
  });
});
