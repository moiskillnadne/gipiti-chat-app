import { describe, expect, it } from "vitest";

import {
  sessionCookieNameOf,
  sessionCookieNamesAmong,
} from "@/server/http/session-cookie";

describe("sessionCookieNameOf", () => {
  it("carries the __Secure- prefix over HTTPS only", () => {
    expect(sessionCookieNameOf(true)).toBe("__Secure-authjs.session-token");
    expect(sessionCookieNameOf(false)).toBe("authjs.session-token");
  });
});

describe("sessionCookieNamesAmong", () => {
  it("finds the session cookie among the others", () => {
    // Arrange
    const cookieNames = [
      "utm_params",
      "__Secure-authjs.session-token",
      "__Host-authjs.csrf-token",
    ];

    // Act and assert
    expect(sessionCookieNamesAmong(cookieNames, true)).toEqual([
      "__Secure-authjs.session-token",
    ]);
  });

  it("finds every chunk of a session split over several cookies", () => {
    // Arrange
    const cookieNames = [
      "authjs.session-token.0",
      "authjs.session-token.1",
      "authjs.session-tokens",
      "authjs.callback-url",
    ];

    // Act and assert
    expect(sessionCookieNamesAmong(cookieNames, false)).toEqual([
      "authjs.session-token.0",
      "authjs.session-token.1",
    ]);
  });

  it("does not take the plain-HTTP cookie for the secure one, or the reverse", () => {
    expect(sessionCookieNamesAmong(["authjs.session-token"], true)).toEqual([]);
    expect(
      sessionCookieNamesAmong(["__Secure-authjs.session-token"], false)
    ).toEqual([]);
  });
});
