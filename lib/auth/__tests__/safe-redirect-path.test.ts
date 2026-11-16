import { describe, expect, it } from "vitest";

import {
  DEFAULT_REDIRECT_PATH,
  getSafeRedirectPath,
} from "@/lib/auth/safe-redirect-path";

const ORIGIN = "https://gipiti.ru";

describe("getSafeRedirectPath", () => {
  it.each([
    ["a plain path", "/chat", "/chat"],
    ["a nested path", "/chat/123", "/chat/123"],
    [
      "a path with a query and a fragment",
      "/projects?tab=files#top",
      "/projects?tab=files#top",
    ],
    [
      "an absolute URL on this origin",
      "https://gipiti.ru/subscription?from=login",
      "/subscription?from=login",
    ],
    ["a path without a leading slash", "chat", "/chat"],
  ])("keeps %s", (_case, callbackUrl, expectedPath) => {
    // Act
    const redirectPath = getSafeRedirectPath(callbackUrl, ORIGIN);

    // Assert
    expect(redirectPath).toBe(expectedPath);
  });

  it.each([
    ["a missing value", null],
    ["an undefined value", undefined],
    ["an empty value", ""],
    ["an absolute URL on another host", "https://malicious-site.com/login"],
    ["the same host over http", "http://gipiti.ru/chat"],
    ["a subdomain", "https://evil.gipiti.ru/chat"],
    ["another port", "https://gipiti.ru:8443/chat"],
    ["a protocol-relative URL", "//malicious-site.com/path"],
    ["a backslash instead of the second slash", "/\\malicious-site.com"],
    ["two backslashes", "\\\\malicious-site.com"],
    ["three slashes", "///malicious-site.com"],
    ["a tab between the slashes", "/\t/malicious-site.com"],
    ["a newline between the slashes", "/\n/malicious-site.com"],
    ["a dot segment that collapses to two slashes", "/.//malicious-site.com"],
    ["credentials before another host", "https://gipiti.ru@malicious-site.com"],
    ["a javascript URL", "javascript:alert('xss')"],
    ["a data URL", "data:text/html,<script>alert(1)</script>"],
  ])("falls back to the default for %s", (_case, callbackUrl) => {
    // Act
    const redirectPath = getSafeRedirectPath(callbackUrl, ORIGIN);

    // Assert
    expect(redirectPath).toBe(DEFAULT_REDIRECT_PATH);
  });

  it("compares against the origin of a URL given with a path", () => {
    // Act
    const redirectPath = getSafeRedirectPath(
      "/chat/42",
      "http://localhost:3000/login?callbackUrl=x"
    );

    // Assert
    expect(redirectPath).toBe("/chat/42");
  });

  it("never returns a path a browser would read as another host", () => {
    // Arrange
    const hostileValues = [
      "//malicious-site.com",
      "/\\malicious-site.com",
      "/.//malicious-site.com",
      "/..//malicious-site.com",
      "/%2e//malicious-site.com",
    ];

    // Act
    const redirectPaths = hostileValues.map((value) =>
      getSafeRedirectPath(value, ORIGIN)
    );

    // Assert
    for (const redirectPath of redirectPaths) {
      expect(new URL(redirectPath, ORIGIN).origin).toBe(ORIGIN);
      expect(redirectPath.startsWith("//")).toBe(false);
    }
  });
});
