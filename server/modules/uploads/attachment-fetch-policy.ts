import { MAX_ATTACHMENT_BYTES } from "@/lib/attachments/attachment-limits";

/**
 * The one place that decides which attachment URLs the server may download,
 * and how much of them.
 *
 * A file part's `url` arrives from the client, and the server then fetches it
 * to inline text and .docx content for the model and to load the source image
 * for an edit. Fetching whatever URL the client names is server-side request
 * forgery: internal addresses, cloud metadata endpoints, or simply a huge or
 * never-ending response. Every upload is stored in the app's own Vercel Blob
 * store, so that host is the only one a legitimate attachment can have.
 */

const BLOB_PUBLIC_HOST_SUFFIX = ".public.blob.vercel-storage.com";
const BLOB_TOKEN_PREFIX = "vercel_blob_rw_";
/** `vercel_blob_rw_<storeId>_<secret>`: the store id is the fourth segment. */
const BLOB_TOKEN_STORE_ID_INDEX = 3;

/**
 * Largest attachment the server will download. Uploads are capped at
 * `MAX_ATTACHMENT_BYTES`, but text files are re-encoded to UTF-8 before they
 * are stored and a Windows-1251 character can take up to three bytes there,
 * so a legitimate stored blob can be up to three times the upload limit.
 */
export const MAX_ATTACHMENT_FETCH_BYTES = 3 * MAX_ATTACHMENT_BYTES;

/** Covers the whole download (headers and body), not just the first byte. */
export const ATTACHMENT_FETCH_TIMEOUT_MS = 15_000;

export type AttachmentFetchFailureReason =
  | "url_not_allowed"
  | "http_error"
  | "too_large"
  | "timeout";

/** Thrown by `fetchAttachmentBytes` when the policy refuses or cuts a download. */
export class AttachmentFetchError extends Error {
  readonly reason: AttachmentFetchFailureReason;

  constructor(reason: AttachmentFetchFailureReason, message: string) {
    super(message);
    this.name = "AttachmentFetchError";
    this.reason = reason;
  }
}

export type AttachmentFetchOptions = {
  /** Override of `MAX_ATTACHMENT_FETCH_BYTES`. */
  maxBytes?: number;
  /** Override of `ATTACHMENT_FETCH_TIMEOUT_MS`. */
  timeoutMs?: number;
  /** Caller's own abort signal (a user stop), honoured alongside the timeout. */
  signal?: AbortSignal;
};

/**
 * Host of the app's own Blob store, derived from `BLOB_READ_WRITE_TOKEN` the
 * way `@vercel/blob` reads the store id from it. Undefined when the token is
 * absent or has an unexpected shape (unit tests, local dev without Blob).
 */
const resolveOwnBlobHost = (): string | undefined => {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token?.startsWith(BLOB_TOKEN_PREFIX)) {
    return;
  }
  const storeId = token.split("_")[BLOB_TOKEN_STORE_ID_INDEX];
  return storeId
    ? `${storeId.toLowerCase()}${BLOB_PUBLIC_HOST_SUFFIX}`
    : undefined;
};

const isPublicBlobHost = (hostname: string): boolean =>
  hostname.endsWith(BLOB_PUBLIC_HOST_SUFFIX) &&
  hostname.length > BLOB_PUBLIC_HOST_SUFFIX.length;

/**
 * True when `rawUrl` points at the app's Vercel Blob store over HTTPS.
 *
 * With a configured token only that exact store is accepted. Without one the
 * check falls back to any public Vercel Blob host, which still rules out
 * every internal or arbitrary address.
 */
export const isAllowedAttachmentUrl = (rawUrl: string): boolean => {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  const hasCredentialsOrPort =
    url.username !== "" || url.password !== "" || url.port !== "";
  if (url.protocol !== "https:" || hasCredentialsOrPort) {
    return false;
  }

  const hostname = url.hostname.toLowerCase();
  const ownBlobHost = resolveOwnBlobHost();
  return ownBlobHost ? hostname === ownBlobHost : isPublicBlobHost(hostname);
};

/** Read a response body, giving up as soon as it grows past `maxBytes`. */
const readBodyWithLimit = async (
  response: Response,
  maxBytes: number
): Promise<Uint8Array> => {
  if (!response.body) {
    return new Uint8Array(0);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  for (
    let result = await reader.read();
    !result.done;
    result = await reader.read()
  ) {
    totalBytes += result.value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new AttachmentFetchError(
        "too_large",
        `Attachment is larger than ${maxBytes} bytes`
      );
    }
    chunks.push(result.value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
};

/**
 * Download an attachment under the policy: allowed host only, no redirects
 * (a redirect could lead off the allowed host), bounded in time and in size.
 * The `Content-Length` header is checked first, but the body is also counted
 * while it is read, since the header can be missing or wrong.
 *
 * @throws AttachmentFetchError when the URL is refused, the response is not
 *   2xx, the body is too large or the download times out. An abort of the
 *   caller's own `signal` is rethrown as is.
 */
export const fetchAttachmentBytes = async (
  rawUrl: string,
  options: AttachmentFetchOptions = {}
): Promise<Uint8Array> => {
  const {
    maxBytes = MAX_ATTACHMENT_FETCH_BYTES,
    timeoutMs = ATTACHMENT_FETCH_TIMEOUT_MS,
    signal,
  } = options;

  if (!isAllowedAttachmentUrl(rawUrl)) {
    throw new AttachmentFetchError(
      "url_not_allowed",
      "Attachment URL is not on the app's Blob store"
    );
  }

  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const fetchSignal = signal
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal;

  try {
    const response = await fetch(rawUrl, {
      signal: fetchSignal,
      redirect: "error",
    });

    if (!response.ok) {
      throw new AttachmentFetchError(
        "http_error",
        `Attachment download failed with status ${response.status}`
      );
    }

    const declaredBytes = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
      await response.body?.cancel();
      throw new AttachmentFetchError(
        "too_large",
        `Attachment is larger than ${maxBytes} bytes`
      );
    }

    return await readBodyWithLimit(response, maxBytes);
  } catch (error) {
    if (error instanceof AttachmentFetchError) {
      throw error;
    }
    const isCallerAbort = signal?.aborted ?? false;
    if (timeoutSignal.aborted && !isCallerAbort) {
      throw new AttachmentFetchError(
        "timeout",
        `Attachment download took longer than ${timeoutMs} ms`
      );
    }
    throw error;
  }
};
