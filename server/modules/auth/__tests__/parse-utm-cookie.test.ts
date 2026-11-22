import { describe, expect, it } from "vitest";

import {
  decodeUtmCookieValue,
  parseUtmCookie,
} from "@/server/modules/auth/parse-utm-cookie";

describe("decodeUtmCookieValue", () => {
  it("decodes a value that is still percent-encoded", () => {
    // Arrange
    const json = '{"utm_source":"newsletter"}';

    // Act and assert
    expect(decodeUtmCookieValue(encodeURIComponent(json))).toBe(json);
  });

  it("keeps an already decoded value with a literal percent sign", () => {
    // Arrange: what the cookie parser hands over for `?utm_campaign=50%25off`.
    const json = '{"utm_campaign":"50%off"}';

    // Act
    const decoded = decodeUtmCookieValue(json);

    // Assert
    expect(decoded).toBe(json);
    expect(parseUtmCookie(decoded)?.utmCampaign).toBe("50%off");
  });
});

describe("parseUtmCookie", () => {
  it("maps the five UTM fields and fills the missing ones with null", () => {
    expect(parseUtmCookie('{"utm_source":"x","utm_term":"y"}')).toEqual({
      utmSource: "x",
      utmMedium: null,
      utmCampaign: null,
      utmContent: null,
      utmTerm: "y",
    });
  });

  it.each<[string, string | undefined]>([
    ["no cookie", undefined],
    ["an empty cookie", ""],
    ["a cookie that is not JSON", "not-json"],
  ])("answers null for %s", (_case, cookieValue) => {
    expect(parseUtmCookie(cookieValue)).toBeNull();
  });

  it("cuts a value to 255 characters", () => {
    // Arrange
    const longValue = "a".repeat(300);

    // Act
    const utm = parseUtmCookie(JSON.stringify({ utm_source: longValue }));

    // Assert
    expect(utm?.utmSource).toHaveLength(255);
  });
});
