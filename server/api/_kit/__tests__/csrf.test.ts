import { describe, expect, it } from "vitest";

import {
  hasSameOriginProof,
  isStateChanging,
} from "@/server/api/_kit/guards/csrf";

const SITE = "https://gipiti.test";

const requestWith = (
  headers: Record<string, string>,
  method = "POST"
): Request =>
  new Request(`${SITE}/api/v1/auth/logout-all`, { method, headers });

describe("isStateChanging", () => {
  it.each(["POST", "PUT", "PATCH", "DELETE"])("is true for %s", (method) => {
    expect(isStateChanging(requestWith({}, method))).toBe(true);
  });

  it.each(["GET", "HEAD"])("is false for %s", (method) => {
    expect(isStateChanging(requestWith({}, method))).toBe(false);
  });
});

describe("hasSameOriginProof", () => {
  it("accepts a request the browser marks as same-origin", () => {
    expect(
      hasSameOriginProof(requestWith({ "sec-fetch-site": "same-origin" }))
    ).toBe(true);
  });

  it.each(["cross-site", "same-site", "none"])(
    "refuses a request the browser marks as %s, even with a matching Origin",
    (fetchSite) => {
      // Arrange: `Sec-Fetch-Site` is what the browser vouches for; a matching
      // `Origin` next to it does not override it.
      const request = requestWith({
        "sec-fetch-site": fetchSite,
        origin: SITE,
      });

      // Act and assert
      expect(hasSameOriginProof(request)).toBe(false);
    }
  );

  it("falls back to the Origin header when the browser sends no Sec-Fetch-Site", () => {
    expect(hasSameOriginProof(requestWith({ origin: SITE }))).toBe(true);
  });

  it("refuses an Origin of another site", () => {
    expect(
      hasSameOriginProof(requestWith({ origin: "https://evil.example" }))
    ).toBe(false);
  });

  it("refuses a sibling subdomain and a look-alike host", () => {
    expect(
      hasSameOriginProof(requestWith({ origin: "https://blog.gipiti.test" }))
    ).toBe(false);
    expect(
      hasSameOriginProof(
        requestWith({ origin: "https://gipiti.test.evil.example" })
      )
    ).toBe(false);
  });

  it("compares with the host the client addressed, behind the platform's proxy", () => {
    // Arrange: the function sees an internal URL; the public host is forwarded.
    const request = new Request("http://internal:3000/api/v1/auth/logout-all", {
      method: "POST",
      headers: { origin: SITE, "x-forwarded-host": "gipiti.test" },
    });

    // Act and assert
    expect(hasSameOriginProof(request)).toBe(true);
  });

  it.each<[string, Record<string, string>]>([
    ["no proof at all", {}],
    ["an Origin that is not a URL", { origin: "null" }],
  ])("refuses a request with %s", (_case, headers) => {
    expect(hasSameOriginProof(requestWith(headers))).toBe(false);
  });
});
