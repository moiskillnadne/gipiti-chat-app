import type { LookupAddress } from "node:dns";
import { lookup as dnsLookup } from "node:dns";
import { EventEmitter } from "node:events";
import type { ClientRequest, IncomingMessage } from "node:http";
import type { RequestOptions } from "node:https";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("node:dns", () => ({ lookup: vi.fn() }));
vi.mock("node:https", () => ({ request: vi.fn() }));

import {
  fetchPublicImageBytes,
  isAllowedRemoteImageUrl,
  lookupPublicAddress,
  RemoteImageFetchError,
} from "@/lib/ai/remote-image-fetch";

const IMAGE_URL = "https://images.test/photo.png";
const PUBLIC_ADDRESS: LookupAddress = { address: "93.184.216.34", family: 4 };
const OTHER_PUBLIC_ADDRESS: LookupAddress = {
  address: "2606:2800:220:1:248:1893:25c8:1946",
  family: 6,
};
const PRIVATE_ADDRESS: LookupAddress = { address: "10.0.0.5", family: 4 };
const IMAGE_HEADERS = { "content-type": "image/png" };

const bytesOf = (length: number): Buffer => Buffer.alloc(length, 65);

type FakeResponseInit = {
  statusCode?: number;
  headers?: Record<string, string>;
  body?: Readable;
};

const fakeResponse = ({
  statusCode = 200,
  headers = IMAGE_HEADERS,
  body = Readable.from([bytesOf(4)]),
}: FakeResponseInit = {}): IncomingMessage =>
  Object.assign(body, { statusCode, headers }) as unknown as IncomingMessage;

const redirectTo = (location: string, statusCode = 302): IncomingMessage =>
  fakeResponse({ statusCode, headers: { location } });

/** A body that sends `chunkCount` chunks and reports no Content-Length. */
const chunkedBody = (chunkCount: number, chunkBytes: number): Readable =>
  Readable.from(Array.from({ length: chunkCount }, () => bytesOf(chunkBytes)));

/** A body that sends one chunk and then never ends. */
const stalledBody = (): Readable => {
  const body = new Readable({ read: vi.fn() });
  body.push(bytesOf(4));
  return body;
};

/** A server that accepts the connection and never answers. */
const NO_ANSWER = Symbol("no answer");
type RequestOutcome = IncomingMessage | Error | typeof NO_ANSWER;
type RequestCall = { url: URL; options: RequestOptions };

let requestCalls: RequestCall[] = [];
let addressesByHost = new Map<string, LookupAddress[]>();

const IPV6_BRACKETS_PATTERN = /^\[|\]$/g;

const isIpLiteralHost = (hostname: string): boolean =>
  isIP(hostname.replace(IPV6_BRACKETS_PATTERN, "")) !== 0;

/**
 * Stands in for `https.request`. Like the real one it resolves a hostname
 * through the request's own `lookup` before anything is sent, connects to an
 * IP-literal host without any lookup, fails the request when the lookup
 * fails, and fails it with an AbortError when the signal fires before a
 * response.
 */
const createFakeRequest = (
  url: URL,
  options: RequestOptions,
  outcome: RequestOutcome
): ClientRequest => {
  const request = new EventEmitter();
  let isSettled = false;
  const settle = (event: "response" | "error", payload: unknown): void => {
    if (!isSettled) {
      isSettled = true;
      request.emit(event, payload);
    }
  };

  const answer = (): void => {
    if (outcome !== NO_ANSWER) {
      settle(outcome instanceof Error ? "error" : "response", outcome);
    }
  };
  const end = (): void => {
    if (isIpLiteralHost(url.hostname)) {
      answer();
      return;
    }
    options.lookup?.(url.hostname, { all: true }, (lookupError) => {
      if (lookupError) {
        settle("error", lookupError);
        return;
      }
      answer();
    });
  };
  options.signal?.addEventListener("abort", () =>
    settle("error", new DOMException("The operation was aborted", "AbortError"))
  );

  return Object.assign(request, { end }) as unknown as ClientRequest;
};

/** Answer successive `https.request` calls with `outcomes`, in order. */
const stubRequests = (...outcomes: RequestOutcome[]): void => {
  const pendingOutcomes = [...outcomes];
  const fakeHttpsRequest = (
    url: URL,
    options: RequestOptions
  ): ClientRequest => {
    requestCalls.push({ url, options });
    return createFakeRequest(
      url,
      options,
      pendingOutcomes.shift() ?? NO_ANSWER
    );
  };
  vi.mocked(httpsRequest).mockImplementation(
    fakeHttpsRequest as unknown as typeof httpsRequest
  );
};

type DnsCallback = (
  error: NodeJS.ErrnoException | null,
  addresses: LookupAddress[]
) => void;

/** Every host resolves to one public address unless `addressesByHost` says otherwise. */
const stubDns = (dnsError?: NodeJS.ErrnoException): void => {
  const fakeDnsLookup = (
    hostname: string,
    _options: unknown,
    callback: DnsCallback
  ): void => {
    if (dnsError) {
      callback(dnsError, []);
      return;
    }
    callback(null, addressesByHost.get(hostname) ?? [PUBLIC_ADDRESS]);
  };
  vi.mocked(dnsLookup).mockImplementation(
    fakeDnsLookup as unknown as typeof dnsLookup
  );
};

beforeEach(() => {
  requestCalls = [];
  addressesByHost = new Map();
  stubDns();
});

afterEach(() => {
  vi.resetAllMocks();
});

describe("isAllowedRemoteImageUrl", () => {
  it.each([
    ["a public https host", IMAGE_URL],
    ["the default port written out", "https://images.test:443/photo.png"],
    ["a public IPv4 literal", "https://93.184.216.34/photo.png"],
    ["a public IPv6 literal", "https://[2606:4700:4700::1111]/photo.png"],
    ["a host that only contains localhost", "https://localhost.example.com/a"],
  ])("accepts %s", (_label, url) => {
    expect(isAllowedRemoteImageUrl(url)).toBe(true);
  });

  it.each([
    ["plain http", "http://images.test/photo.png"],
    ["credentials", "https://user:secret@images.test/photo.png"],
    ["a user name only", "https://user@images.test/photo.png"],
    ["a non-default port", "https://images.test:8443/photo.png"],
    ["localhost", "https://localhost/photo.png"],
    ["localhost in upper case", "https://LOCALHOST/photo.png"],
    ["localhost with a trailing dot", "https://localhost./photo.png"],
    ["a localhost subdomain", "https://app.localhost/photo.png"],
    ["a loopback literal", "https://127.0.0.1/photo.png"],
    ["a shorthand loopback literal", "https://127.1/photo.png"],
    ["a decimal loopback literal", "https://2130706433/photo.png"],
    ["a hex loopback literal", "https://0x7f000001/photo.png"],
    ["the metadata address", "https://169.254.169.254/latest/meta-data/"],
    ["a private literal", "https://192.168.1.10/photo.png"],
    ["an IPv6 loopback literal", "https://[::1]/photo.png"],
    ["an IPv4-mapped loopback literal", "https://[::ffff:127.0.0.1]/a.png"],
    ["a unique-local literal", "https://[fd00::1]/photo.png"],
    ["a data URL", "data:image/png;base64,AAAA"],
    ["a file URL", "file:///etc/passwd"],
    ["a relative path", "/images/photo.png"],
    ["not a URL", "not a url"],
  ])("refuses %s", (_label, url) => {
    expect(isAllowedRemoteImageUrl(url)).toBe(false);
  });
});

describe("lookupPublicAddress", () => {
  it("hands over every address when all of them are public", () => {
    // Arrange
    addressesByHost.set("images.test", [PUBLIC_ADDRESS, OTHER_PUBLIC_ADDRESS]);
    const callback = vi.fn();

    // Act
    lookupPublicAddress("images.test", { all: true }, callback);

    // Assert
    expect(callback).toHaveBeenCalledWith(null, [
      PUBLIC_ADDRESS,
      OTHER_PUBLIC_ADDRESS,
    ]);
  });

  it("hands over the first address when a single one is asked for", () => {
    // Arrange
    addressesByHost.set("images.test", [PUBLIC_ADDRESS, OTHER_PUBLIC_ADDRESS]);
    const callback = vi.fn();

    // Act
    lookupPublicAddress("images.test", { family: 4 }, callback);

    // Assert
    expect(callback).toHaveBeenCalledWith(null, PUBLIC_ADDRESS.address, 4);
    expect(dnsLookup).toHaveBeenCalledWith(
      "images.test",
      { family: 4, all: true },
      expect.any(Function)
    );
  });

  it.each([
    [
      "one private address among several public ones",
      [PUBLIC_ADDRESS, PRIVATE_ADDRESS, OTHER_PUBLIC_ADDRESS],
    ],
    ["only a loopback address", [{ address: "127.0.0.1", family: 4 }]],
    ["the metadata address", [{ address: "169.254.169.254", family: 4 }]],
    [
      "an IPv4-mapped private address",
      [PUBLIC_ADDRESS, { address: "::ffff:10.0.0.5", family: 6 }],
    ],
    ["no address at all", []],
  ])("refuses a host that resolves to %s", (_label, addresses) => {
    // Arrange
    addressesByHost.set("rebind.test", addresses);
    const callback = vi.fn();

    // Act
    lookupPublicAddress("rebind.test", { all: true }, callback);

    // Assert
    const [lookupError, handedAddresses] = callback.mock.calls[0];
    expect(lookupError).toBeInstanceOf(RemoteImageFetchError);
    expect(lookupError).toMatchObject({ reason: "address_not_allowed" });
    expect(handedAddresses).toEqual([]);
  });

  it("passes a DNS failure on unchanged", () => {
    // Arrange
    const dnsError = Object.assign(new Error("getaddrinfo ENOTFOUND"), {
      code: "ENOTFOUND",
    });
    stubDns(dnsError);
    const callback = vi.fn();

    // Act
    lookupPublicAddress("missing.test", { all: true }, callback);

    // Assert
    expect(callback).toHaveBeenCalledWith(dnsError, []);
  });
});

describe("fetchPublicImageBytes", () => {
  it("returns the image bytes, connecting through the checking lookup", async () => {
    // Arrange
    stubRequests(
      fakeResponse({ body: Readable.from([bytesOf(3), bytesOf(2)]) })
    );

    // Act
    const bytes = await fetchPublicImageBytes(IMAGE_URL);

    // Assert
    expect(Buffer.from(bytes)).toEqual(bytesOf(5));
    expect(requestCalls).toHaveLength(1);
    expect(requestCalls[0].url.href).toBe(IMAGE_URL);
    expect(requestCalls[0].options).toMatchObject({
      method: "GET",
      agent: false,
      lookup: lookupPublicAddress,
    });
  });

  it.each([
    ["plain http", "http://images.test/photo.png"],
    ["credentials", "https://user:secret@images.test/photo.png"],
    ["a non-default port", "https://images.test:8443/photo.png"],
    ["localhost", "https://localhost/photo.png"],
    ["the metadata address", "https://169.254.169.254/latest/meta-data/"],
  ])("makes no request for a URL with %s", async (_label, url) => {
    // Arrange
    stubRequests(fakeResponse());

    // Act
    const download = fetchPublicImageBytes(url);

    // Assert
    await expect(download).rejects.toBeInstanceOf(RemoteImageFetchError);
    await expect(download).rejects.toMatchObject({ reason: "url_not_allowed" });
    expect(requestCalls).toHaveLength(0);
  });

  it.each([
    ["an IPv4 literal", "https://93.184.216.34/photo.png"],
    ["an IPv6 literal", "https://[2606:4700:4700::1111]/photo.png"],
  ])(
    "connects to a public host given as %s without a DNS lookup",
    async (_label, url) => {
      // Arrange
      stubRequests(fakeResponse());

      // Act
      const bytes = await fetchPublicImageBytes(url);

      // Assert
      expect(bytes.byteLength).toBe(4);
      expect(dnsLookup).not.toHaveBeenCalled();
    }
  );

  it.each([
    ["a benchmarking address", "https://198.18.0.1/photo.png"],
    ["a documentation address", "https://[2001:db8::1]/photo.png"],
    ["an IPv4-translated address", "https://[::ffff:0:169.254.169.254]/a.png"],
  ])("makes no request for %s given as a literal", async (_label, url) => {
    // Arrange
    stubRequests(fakeResponse());

    // Act
    const download = fetchPublicImageBytes(url);

    // Assert
    await expect(download).rejects.toMatchObject({ reason: "url_not_allowed" });
    expect(requestCalls).toHaveLength(0);
    expect(dnsLookup).not.toHaveBeenCalled();
  });

  it("refuses a host that resolves to one private address among public ones", async () => {
    // Arrange
    addressesByHost.set("images.test", [
      PUBLIC_ADDRESS,
      PRIVATE_ADDRESS,
      OTHER_PUBLIC_ADDRESS,
    ]);
    stubRequests(fakeResponse());

    // Act
    const download = fetchPublicImageBytes(IMAGE_URL);

    // Assert
    await expect(download).rejects.toBeInstanceOf(RemoteImageFetchError);
    await expect(download).rejects.toMatchObject({
      reason: "address_not_allowed",
    });
  });

  describe("redirects", () => {
    it("follows up to three redirects, resolving a relative Location", async () => {
      // Arrange
      stubRequests(
        redirectTo("https://cdn.test/a.png", 301),
        redirectTo("/b.png", 307),
        redirectTo("https://static.test/c.png", 308),
        fakeResponse({ body: Readable.from([bytesOf(7)]) })
      );

      // Act
      const bytes = await fetchPublicImageBytes(IMAGE_URL);

      // Assert
      expect(bytes.byteLength).toBe(7);
      expect(requestCalls.map(({ url }) => url.href)).toEqual([
        IMAGE_URL,
        "https://cdn.test/a.png",
        "https://cdn.test/b.png",
        "https://static.test/c.png",
      ]);
      expect(
        requestCalls.every(
          ({ options }) => options.lookup === lookupPublicAddress
        )
      ).toBe(true);
    });

    it("refuses a fourth redirect", async () => {
      // Arrange
      stubRequests(
        redirectTo("https://hop1.test/a.png"),
        redirectTo("https://hop2.test/a.png"),
        redirectTo("https://hop3.test/a.png"),
        redirectTo("https://hop4.test/a.png"),
        fakeResponse()
      );

      // Act
      const download = fetchPublicImageBytes(IMAGE_URL);

      // Assert
      await expect(download).rejects.toMatchObject({
        reason: "too_many_redirects",
      });
      expect(requestCalls).toHaveLength(4);
    });

    it.each([
      ["a private address", "https://10.0.0.5/secret.png"],
      ["the metadata address", "https://169.254.169.254/latest/meta-data/"],
      ["localhost", "https://localhost/admin.png"],
      ["plain http", "http://images.test/photo.png"],
      ["a non-default port", "https://images.test:8443/photo.png"],
    ])("does not follow a redirect to %s", async (_label, location) => {
      // Arrange
      stubRequests(redirectTo(location), fakeResponse());

      // Act
      const download = fetchPublicImageBytes(IMAGE_URL);

      // Assert
      await expect(download).rejects.toMatchObject({
        reason: "url_not_allowed",
      });
      expect(requestCalls).toHaveLength(1);
    });

    it("refuses a redirect to a host that resolves to a private address", async () => {
      // Arrange
      addressesByHost.set("internal.test", [PRIVATE_ADDRESS]);
      stubRequests(
        redirectTo("https://internal.test/secret.png"),
        fakeResponse()
      );

      // Act
      const download = fetchPublicImageBytes(IMAGE_URL);

      // Assert
      await expect(download).rejects.toMatchObject({
        reason: "address_not_allowed",
      });
    });

    it("closes the response of a redirect it leaves behind", async () => {
      // Arrange
      const redirect = redirectTo("https://cdn.test/a.png");
      stubRequests(redirect, fakeResponse());

      // Act
      await fetchPublicImageBytes(IMAGE_URL);

      // Assert
      expect(redirect.destroyed).toBe(true);
    });
  });

  describe("response checks", () => {
    it.each([
      ["a missing image", 404],
      ["a server error", 500],
      ["a redirect without a Location", 302],
      ["not modified", 304],
    ])("reports %s as an http error", async (_label, statusCode) => {
      // Arrange
      stubRequests(fakeResponse({ statusCode }));

      // Act
      const download = fetchPublicImageBytes(IMAGE_URL);

      // Assert
      await expect(download).rejects.toMatchObject({ reason: "http_error" });
    });

    it.each([
      ["an HTML page", { "content-type": "text/html; charset=utf-8" }],
      ["JSON", { "content-type": "application/json" }],
      ["no content type", {}],
    ])("refuses a response with %s", async (_label, headers) => {
      // Arrange
      const response = fakeResponse({ headers });
      stubRequests(response);

      // Act
      const download = fetchPublicImageBytes(IMAGE_URL);

      // Assert
      await expect(download).rejects.toMatchObject({ reason: "not_an_image" });
      expect(response.destroyed).toBe(true);
    });

    it("accepts a content type in any letter case with parameters", async () => {
      // Arrange
      stubRequests(
        fakeResponse({ headers: { "content-type": "Image/SVG+XML; q=1" } })
      );

      // Act
      const bytes = await fetchPublicImageBytes(IMAGE_URL);

      // Assert
      expect(bytes.byteLength).toBe(4);
    });

    it("refuses a body whose Content-Length is over the cap without reading it", async () => {
      // Arrange
      const body = Readable.from([bytesOf(8)]);
      const readSpy = vi.spyOn(body, "read");
      stubRequests(
        fakeResponse({
          headers: { ...IMAGE_HEADERS, "content-length": "1000000" },
          body,
        })
      );

      // Act
      const download = fetchPublicImageBytes(IMAGE_URL, { maxBytes: 100 });

      // Assert
      await expect(download).rejects.toMatchObject({ reason: "too_large" });
      expect(readSpy).not.toHaveBeenCalled();
      expect(body.destroyed).toBe(true);
    });

    it("stops reading a body that grows past the cap without a Content-Length", async () => {
      // Arrange
      const body = chunkedBody(1000, 64);
      stubRequests(fakeResponse({ body }));

      // Act
      const download = fetchPublicImageBytes(IMAGE_URL, { maxBytes: 100 });

      // Assert
      await expect(download).rejects.toMatchObject({ reason: "too_large" });
      expect(body.destroyed).toBe(true);
    });

    it("stops reading a body that is larger than its Content-Length claims", async () => {
      // Arrange
      stubRequests(
        fakeResponse({
          headers: { ...IMAGE_HEADERS, "content-length": "10" },
          body: chunkedBody(1000, 64),
        })
      );

      // Act
      const download = fetchPublicImageBytes(IMAGE_URL, { maxBytes: 100 });

      // Assert
      await expect(download).rejects.toMatchObject({ reason: "too_large" });
    });

    it("accepts a body exactly at the cap", async () => {
      // Arrange
      stubRequests(fakeResponse({ body: chunkedBody(2, 50) }));

      // Act
      const bytes = await fetchPublicImageBytes(IMAGE_URL, { maxBytes: 100 });

      // Assert
      expect(bytes.byteLength).toBe(100);
    });
  });

  describe("time limits and failures", () => {
    it("gives up when the server never answers", async () => {
      // Arrange
      stubRequests(NO_ANSWER);

      // Act
      const download = fetchPublicImageBytes(IMAGE_URL, { timeoutMs: 20 });

      // Assert
      await expect(download).rejects.toBeInstanceOf(RemoteImageFetchError);
      await expect(download).rejects.toMatchObject({ reason: "timeout" });
    });

    it("gives up when the body stops arriving", async () => {
      // Arrange
      const body = stalledBody();
      stubRequests(fakeResponse({ body }));

      // Act
      const download = fetchPublicImageBytes(IMAGE_URL, { timeoutMs: 20 });

      // Assert
      await expect(download).rejects.toMatchObject({ reason: "timeout" });
      expect(body.destroyed).toBe(true);
    });

    it("counts the redirect hops against the same time limit", async () => {
      // Arrange
      stubRequests(redirectTo("https://cdn.test/a.png"), NO_ANSWER);

      // Act
      const download = fetchPublicImageBytes(IMAGE_URL, { timeoutMs: 20 });

      // Assert
      await expect(download).rejects.toMatchObject({ reason: "timeout" });
      expect(requestCalls).toHaveLength(2);
    });

    it("rethrows the caller's own abort instead of calling it a timeout", async () => {
      // Arrange
      const callerAbort = new AbortController();
      stubRequests(NO_ANSWER);

      // Act
      const download = fetchPublicImageBytes(IMAGE_URL, {
        signal: callerAbort.signal,
      });
      callerAbort.abort(new DOMException("deadline", "AbortError"));

      // Assert
      await expect(download).rejects.toMatchObject({
        name: "AbortError",
        message: "deadline",
      });
    });

    it("makes no request when the caller's signal is already aborted", async () => {
      // Arrange
      stubRequests(fakeResponse());
      const abortedSignal = AbortSignal.abort(
        new DOMException("deadline", "AbortError")
      );

      // Act
      const download = fetchPublicImageBytes(IMAGE_URL, {
        signal: abortedSignal,
      });

      // Assert
      await expect(download).rejects.toMatchObject({ name: "AbortError" });
      expect(requestCalls).toHaveLength(0);
    });

    it("reports a connection failure as a network error with its cause", async () => {
      // Arrange
      const connectionError = Object.assign(new Error("connect ECONNREFUSED"), {
        code: "ECONNREFUSED",
      });
      stubRequests(connectionError);

      // Act
      const download = fetchPublicImageBytes(IMAGE_URL);

      // Assert
      await expect(download).rejects.toMatchObject({
        reason: "network_error",
        cause: connectionError,
      });
    });
  });
});
