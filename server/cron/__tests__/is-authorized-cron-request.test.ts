import { afterEach, describe, expect, it, vi } from "vitest";

import { isAuthorizedCronRequest } from "../is-authorized-cron-request";

const CRON_SECRET = "test-cron-secret";

const cronRequest = (authorization?: string): Request =>
  new Request("https://example.test/api/cron/reset-quotas", {
    headers: authorization ? { authorization } : {},
  });

describe("isAuthorizedCronRequest", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts the configured secret as a bearer token", () => {
    vi.stubEnv("CRON_SECRET", CRON_SECRET);

    expect(isAuthorizedCronRequest(cronRequest(`Bearer ${CRON_SECRET}`))).toBe(
      true
    );
  });

  it("rejects a wrong secret, a bare secret and a missing header", () => {
    vi.stubEnv("CRON_SECRET", CRON_SECRET);

    expect(isAuthorizedCronRequest(cronRequest("Bearer wrong-secret"))).toBe(
      false
    );
    expect(isAuthorizedCronRequest(cronRequest(CRON_SECRET))).toBe(false);
    expect(isAuthorizedCronRequest(cronRequest())).toBe(false);
  });

  it("rejects `Bearer undefined` when the secret is not configured", () => {
    vi.stubEnv("CRON_SECRET", undefined);

    expect(isAuthorizedCronRequest(cronRequest("Bearer undefined"))).toBe(
      false
    );
  });

  it("rejects an empty bearer token when the secret is an empty string", () => {
    vi.stubEnv("CRON_SECRET", "");

    expect(isAuthorizedCronRequest(cronRequest("Bearer "))).toBe(false);
  });
});
