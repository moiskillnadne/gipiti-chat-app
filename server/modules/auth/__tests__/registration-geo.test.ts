import { afterEach, describe, expect, it, vi } from "vitest";

import { getRegistrationGeoFromHeaders } from "@/server/modules/auth/registration-geo";

const readHeaders =
  (entries: Record<string, string>): (() => Promise<Headers>) =>
  () =>
    Promise.resolve(new Headers(entries));

describe("getRegistrationGeoFromHeaders", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads country, region and the decoded city from the Vercel headers", async () => {
    // Arrange
    const readRequestHeaders = readHeaders({
      "x-vercel-ip-country": "US",
      "x-vercel-ip-country-region": "CA",
      "x-vercel-ip-city": "San%20Francisco",
    });

    // Act
    const geo = await getRegistrationGeoFromHeaders(readRequestHeaders);

    // Assert
    expect(geo).toEqual({
      country: "US",
      region: "CA",
      city: "San Francisco",
    });
  });

  it("answers nulls when the headers are absent, as on localhost", async () => {
    // Act
    const geo = await getRegistrationGeoFromHeaders(readHeaders({}));

    // Assert
    expect(geo).toEqual({ country: null, region: null, city: null });
  });

  it("keeps a city that is not valid percent-encoding as it came", async () => {
    // Arrange
    const readRequestHeaders = readHeaders({ "x-vercel-ip-city": "100%" });

    // Act
    const geo = await getRegistrationGeoFromHeaders(readRequestHeaders);

    // Assert
    expect(geo.city).toBe("100%");
  });

  it("answers nulls, and does not throw, when the headers cannot be read", async () => {
    // Arrange
    const consoleError = vi.spyOn(console, "error").mockReturnValue(undefined);
    const readRequestHeaders = (): Promise<Headers> =>
      Promise.reject(new Error("headers() called outside a request scope"));

    // Act
    const geo = await getRegistrationGeoFromHeaders(readRequestHeaders);

    // Assert
    expect(geo).toEqual({ country: null, region: null, city: null });
    expect(consoleError).toHaveBeenCalledOnce();
  });
});
