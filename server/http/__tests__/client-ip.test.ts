import { describe, expect, it } from "vitest";

import { getClientIp, toRateLimitIpKey } from "@/server/http/client-ip";

const headersOf = (entries: Record<string, string>): Headers =>
  new Headers(entries);

describe("getClientIp", () => {
  it.each([
    [
      "a single IPv4 address",
      { "x-forwarded-for": "203.0.113.7" },
      "203.0.113.7",
    ],
    [
      "the first entry of a proxy chain",
      { "x-forwarded-for": "203.0.113.7, 10.0.0.1, 10.0.0.2" },
      "203.0.113.7",
    ],
    [
      "an IPv6 address",
      { "x-forwarded-for": "2001:db8:1:2:3:4:5:6" },
      "2001:db8:1:2:3:4:5:6",
    ],
    [
      "x-real-ip when there is no chain",
      { "x-real-ip": "198.51.100.9" },
      "198.51.100.9",
    ],
    [
      "x-forwarded-for before x-real-ip",
      { "x-forwarded-for": "203.0.113.7", "x-real-ip": "198.51.100.9" },
      "203.0.113.7",
    ],
  ])("reads %s", (_case, entries, expectedIp) => {
    // Act
    const clientIp = getClientIp(headersOf(entries));

    // Assert
    expect(clientIp).toBe(expectedIp);
  });

  it.each([
    ["no header", {}],
    ["an empty header", { "x-forwarded-for": "" }],
    ["a value that is not an address", { "x-forwarded-for": "unknown" }],
    ["an address with a port", { "x-forwarded-for": "203.0.113.7:4711" }],
    [
      "text made to look like a key",
      { "x-forwarded-for": "a@b.test|203.0.113.7" },
    ],
  ])("returns null for %s", (_case, entries) => {
    // Act
    const clientIp = getClientIp(headersOf(entries));

    // Assert
    expect(clientIp).toBeNull();
  });
});

describe("toRateLimitIpKey", () => {
  it.each([
    ["an IPv4 address as itself", "203.0.113.7", "203.0.113.7"],
    [
      "an IPv4-mapped address as its IPv4 address",
      "::ffff:203.0.113.7",
      "203.0.113.7",
    ],
    [
      "a full IPv6 address by its /64",
      "2001:db8:1:2:3:4:5:6",
      "2001:db8:1:2::/64",
    ],
    [
      "a compressed IPv6 address by its /64",
      "2001:db8:1:2::9",
      "2001:db8:1:2::/64",
    ],
    [
      "leading zeros and upper case alike",
      "2001:0DB8:0001:0002::9",
      "2001:db8:1:2::/64",
    ],
    [
      "a compression inside the network half",
      "2001:db8::5:6",
      "2001:db8:0:0::/64",
    ],
    ["the loopback address", "::1", "0:0:0:0::/64"],
  ])("keys %s", (_case, ip, expectedKey) => {
    // Act
    const key = toRateLimitIpKey(ip);

    // Assert
    expect(key).toBe(expectedKey);
  });

  it("gives every address of one /64 the same key", () => {
    // Arrange
    const addresses = ["2001:db8:1:2::1", "2001:db8:1:2:ffff:ffff:ffff:ffff"];

    // Act
    const keys = new Set(addresses.map(toRateLimitIpKey));

    // Assert
    expect(keys.size).toBe(1);
  });

  it("keeps neighbouring /64 networks apart", () => {
    // Act
    const keys = new Set(
      ["2001:db8:1:2::1", "2001:db8:1:3::1"].map(toRateLimitIpKey)
    );

    // Assert
    expect(keys.size).toBe(2);
  });
});
