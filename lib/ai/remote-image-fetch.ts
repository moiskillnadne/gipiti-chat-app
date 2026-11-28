import "server-only";

import { lookup as dnsLookup } from "node:dns";
import type { IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { addAbortSignal } from "node:stream";

import { isPublicAddress } from "./public-address";

/**
 * The one place that downloads an image whose URL was written by the model.
 *
 * Generated documents embed the images their markdown links to, and that
 * markdown can be steered by a prompt injection (a web-search result, an
 * uploaded file). Fetching whatever URL it names is server-side request
 * forgery: localhost, private networks, the cloud metadata endpoint. Any
 * PUBLIC host is legitimate here, so instead of a host allow-list (see
 * `server/modules/uploads/attachment-fetch-policy.ts`) the policy is: `https` on the
 * default port, and only to addresses that are publicly routable.
 *
 * The address check runs inside the connection's own DNS `lookup`, so it is
 * made on the addresses the socket then connects to. Checking a hostname
 * first and connecting afterwards would resolve it twice, and the second
 * answer could differ from the checked one (DNS rebinding).
 */

/** Largest image the server will download. */
export const MAX_REMOTE_IMAGE_BYTES = 10 * 1024 * 1024;

/** Covers one image end to end: every redirect hop, headers and body. */
export const REMOTE_IMAGE_FETCH_TIMEOUT_MS = 10_000;

/** Redirects followed before giving up; each hop is checked like the first URL. */
export const MAX_REMOTE_IMAGE_REDIRECTS = 3;

const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);
const IMAGE_CONTENT_TYPE_PREFIX = "image/";
const LOCALHOST_NAME = "localhost";
const TRAILING_DOT_PATTERN = /\.$/;
const IPV6_BRACKETS_PATTERN = /^\[|\]$/g;

/**
 * `node:https` sends no User-Agent of its own and some image hosts refuse
 * such requests. This is the value global `fetch` sent before this module.
 */
const REQUEST_HEADERS = {
  accept: "image/*,*/*;q=0.5",
  "user-agent": "node",
};

export type RemoteImageFetchFailureReason =
  | "url_not_allowed"
  | "address_not_allowed"
  | "too_many_redirects"
  | "http_error"
  | "not_an_image"
  | "too_large"
  | "timeout"
  | "network_error";

/** Thrown by `fetchPublicImageBytes` when the policy refuses or cuts a download. */
export class RemoteImageFetchError extends Error {
  readonly reason: RemoteImageFetchFailureReason;

  constructor(
    reason: RemoteImageFetchFailureReason,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "RemoteImageFetchError";
    this.reason = reason;
  }
}

export type RemoteImageFetchOptions = {
  /** Override of `MAX_REMOTE_IMAGE_BYTES`. */
  maxBytes?: number;
  /** Override of `REMOTE_IMAGE_FETCH_TIMEOUT_MS`. */
  timeoutMs?: number;
  /** Caller's own abort signal (a batch deadline), honoured alongside the timeout. */
  signal?: AbortSignal;
};

/**
 * Parse `rawUrl` and return it only if it may be requested: `https`, no
 * credentials, default port, and a host that is neither `localhost` nor an IP
 * literal in a blocked range. The WHATWG parser has already normalised
 * shorthand IPv4 hosts (`127.1`, `0x7f000001`, `2130706433`) to dotted form.
 * A hostname that passes here is still checked again once it is resolved.
 */
const parseAllowedUrl = (rawUrl: string): URL | undefined => {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return;
  }

  const hasCredentialsOrPort =
    url.username !== "" || url.password !== "" || url.port !== "";
  if (url.protocol !== "https:" || hasCredentialsOrPort) {
    return;
  }

  const host = url.hostname
    .toLowerCase()
    .replace(IPV6_BRACKETS_PATTERN, "")
    .replace(TRAILING_DOT_PATTERN, "");
  if (isIP(host) !== 0) {
    return isPublicAddress(host) ? url : undefined;
  }

  const isLocalhostName =
    host === LOCALHOST_NAME || host.endsWith(`.${LOCALHOST_NAME}`);
  return isLocalhostName ? undefined : url;
};

/** True when `rawUrl` passes the URL part of the policy (see `parseAllowedUrl`). */
export const isAllowedRemoteImageUrl = (rawUrl: string): boolean =>
  parseAllowedUrl(rawUrl) !== undefined;

const requireAllowedUrl = (rawUrl: string): URL => {
  const url = parseAllowedUrl(rawUrl);
  if (!url) {
    throw new RemoteImageFetchError(
      "url_not_allowed",
      "Image URL must be https on the default port and point at a public host"
    );
  }
  return url;
};

/**
 * DNS `lookup` for the image connection. Resolves every address of the host
 * and refuses the whole request if ANY of them is not public, so a hostname
 * cannot pass by mixing one public record with a private one. The socket is
 * handed only these checked addresses.
 */
export const lookupPublicAddress: LookupFunction = (
  hostname,
  options,
  callback
) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) {
      callback(error, []);
      return;
    }

    const isEveryAddressPublic =
      addresses.length > 0 &&
      addresses.every(({ address }) => isPublicAddress(address));
    if (!isEveryAddressPublic) {
      callback(
        new RemoteImageFetchError(
          "address_not_allowed",
          `Image host ${hostname} does not resolve to public addresses only`
        ),
        []
      );
      return;
    }

    // `net` asks for the full list when it races address families
    // (autoSelectFamily, the default) and for a single address otherwise.
    if (options.all) {
      callback(null, addresses);
      return;
    }
    const [firstAddress] = addresses;
    callback(null, firstAddress.address, firstAddress.family);
  });
};

/** Send one GET and resolve with the response as soon as its headers arrive. */
const sendImageRequest = (
  url: URL,
  signal: AbortSignal
): Promise<IncomingMessage> =>
  new Promise((resolve, reject) => {
    const request = httpsRequest(url, {
      method: "GET",
      headers: REQUEST_HEADERS,
      // No pooled sockets: every request opens its own connection, so every
      // request goes through `lookupPublicAddress`.
      agent: false,
      lookup: lookupPublicAddress,
      signal,
    });
    request.once("response", resolve);
    request.once("error", reject);
    request.end();
  });

/** Absolute target of a redirect response, or undefined when it is not one. */
const redirectTargetOf = (
  response: IncomingMessage,
  requestUrl: URL
): string | undefined => {
  const { location } = response.headers;
  const isRedirect = REDIRECT_STATUS_CODES.has(response.statusCode ?? 0);
  if (!(isRedirect && location)) {
    return;
  }
  try {
    return new URL(location, requestUrl).href;
  } catch {
    throw new RemoteImageFetchError(
      "url_not_allowed",
      "Image redirect has an invalid Location header"
    );
  }
};

/**
 * Request `rawUrl`, following redirects by hand so that every hop goes
 * through the same URL and address checks as the first request.
 */
const requestFollowingRedirects = async (
  rawUrl: string,
  signal: AbortSignal
): Promise<IncomingMessage> => {
  let currentUrl = requireAllowedUrl(rawUrl);

  for (
    let redirectCount = 0;
    redirectCount <= MAX_REMOTE_IMAGE_REDIRECTS;
    redirectCount += 1
  ) {
    const response = await sendImageRequest(currentUrl, signal);
    let redirectTarget: string | undefined;
    try {
      redirectTarget = redirectTargetOf(response, currentUrl);
    } catch (error) {
      response.destroy();
      throw error;
    }
    if (redirectTarget === undefined) {
      return response;
    }

    response.destroy();
    currentUrl = requireAllowedUrl(redirectTarget);
  }

  throw new RemoteImageFetchError(
    "too_many_redirects",
    `Image URL redirected more than ${MAX_REMOTE_IMAGE_REDIRECTS} times`
  );
};

/** Refuse a response that is not a successful image of an acceptable size. */
const assertImageResponse = (
  response: IncomingMessage,
  maxBytes: number
): void => {
  const statusCode = response.statusCode ?? 0;
  if (statusCode < 200 || statusCode > 299) {
    throw new RemoteImageFetchError(
      "http_error",
      `Image download failed with status ${statusCode}`
    );
  }

  const contentType = response.headers["content-type"] ?? "";
  if (!contentType.trim().toLowerCase().startsWith(IMAGE_CONTENT_TYPE_PREFIX)) {
    throw new RemoteImageFetchError(
      "not_an_image",
      `Image URL answered with content type "${contentType}"`
    );
  }

  const declaredBytes = Number(response.headers["content-length"]);
  if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
    throw new RemoteImageFetchError(
      "too_large",
      `Image is larger than ${maxBytes} bytes`
    );
  }
};

/** Read a response body, giving up as soon as it grows past `maxBytes`. */
const readBodyWithLimit = async (
  response: IncomingMessage,
  maxBytes: number
): Promise<Uint8Array> => {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of response) {
    const bodyChunk: Buffer = chunk;
    totalBytes += bodyChunk.byteLength;
    if (totalBytes > maxBytes) {
      throw new RemoteImageFetchError(
        "too_large",
        `Image is larger than ${maxBytes} bytes`
      );
    }
    chunks.push(bodyChunk);
  }

  return Buffer.concat(chunks, totalBytes);
};

/**
 * Download an image under the policy: public `https` hosts only (checked on
 * every redirect hop and on the resolved addresses), a 2xx `image/*`
 * response, bounded in time and in size. The `Content-Length` header is
 * checked first, but the body is also counted while it is read, since the
 * header can be missing or wrong.
 *
 * @throws RemoteImageFetchError when the URL or an address is refused, the
 *   response is not a 2xx image, the body is too large, the download times
 *   out or the connection fails. An abort of the caller's own `signal` is
 *   rethrown as is.
 */
export const fetchPublicImageBytes = async (
  rawUrl: string,
  options: RemoteImageFetchOptions = {}
): Promise<Uint8Array> => {
  const {
    maxBytes = MAX_REMOTE_IMAGE_BYTES,
    timeoutMs = REMOTE_IMAGE_FETCH_TIMEOUT_MS,
    signal,
  } = options;
  signal?.throwIfAborted();

  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const requestSignal = signal
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal;
  let response: IncomingMessage | undefined;

  try {
    response = await requestFollowingRedirects(rawUrl, requestSignal);
    // Aborting the request closes its socket; this also ends a body read
    // that is waiting on a server which stopped sending.
    addAbortSignal(requestSignal, response);
    assertImageResponse(response, maxBytes);
    return await readBodyWithLimit(response, maxBytes);
  } catch (error) {
    if (error instanceof RemoteImageFetchError) {
      throw error;
    }
    if (signal?.aborted) {
      throw signal.reason;
    }
    if (timeoutSignal.aborted) {
      throw new RemoteImageFetchError(
        "timeout",
        `Image download took longer than ${timeoutMs} ms`
      );
    }
    throw new RemoteImageFetchError("network_error", "Image download failed", {
      cause: error,
    });
  } finally {
    // The connection is not reused, so never leave it open: not after a
    // refused response, and not after a body that was cut short.
    response?.destroy();
  }
};
