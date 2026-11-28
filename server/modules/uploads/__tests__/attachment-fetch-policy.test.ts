import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AttachmentFetchError,
  fetchAttachmentBytes,
  isAllowedAttachmentUrl,
} from "../attachment-fetch-policy";

const OWN_STORE_TOKEN = "vercel_blob_rw_AbC123xyZ_secretpart";
const OWN_STORE_URL = "https://abc123xyz.public.blob.vercel-storage.com/a.txt";
const OTHER_STORE_URL = "https://other.public.blob.vercel-storage.com/a.txt";

const bytesOf = (length: number): Uint8Array => new Uint8Array(length).fill(65);

/** A body that arrives in chunks and reports no Content-Length. */
const chunkedResponse = (chunkCount: number, chunkBytes: number): Response => {
  let sentChunks = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sentChunks === chunkCount) {
        controller.close();
        return;
      }
      sentChunks += 1;
      controller.enqueue(bytesOf(chunkBytes));
    },
  });
  return new Response(body, { status: 200 });
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("isAllowedAttachmentUrl", () => {
  it("accepts only the app's own store when the Blob token is configured", () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", OWN_STORE_TOKEN);

    expect(isAllowedAttachmentUrl(OWN_STORE_URL)).toBe(true);
    expect(isAllowedAttachmentUrl(OTHER_STORE_URL)).toBe(false);
  });

  it("falls back to any public Blob host when there is no token", () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", undefined);

    expect(isAllowedAttachmentUrl(OWN_STORE_URL)).toBe(true);
    expect(isAllowedAttachmentUrl(OTHER_STORE_URL)).toBe(true);
  });

  it.each([
    ["an internal address", "http://169.254.169.254/latest/meta-data/"],
    ["localhost", "https://localhost:3000/api/health"],
    ["an arbitrary site", "https://example.com/file.txt"],
    ["plain http on the Blob host", OWN_STORE_URL.replace("https", "http")],
    [
      "a look-alike suffix",
      "https://abc123xyz.public.blob.vercel-storage.com.evil.test/a.txt",
    ],
    [
      "the Blob host as a path",
      "https://evil.test/abc123xyz.public.blob.vercel-storage.com/a.txt",
    ],
    [
      "the Blob host as credentials",
      "https://abc123xyz.public.blob.vercel-storage.com@evil.test/a.txt",
    ],
    ["the bare suffix", "https://.public.blob.vercel-storage.com/a.txt"],
    ["a non-default port", OWN_STORE_URL.replace(".com/", ".com:8443/")],
    ["a data URL", "data:text/plain;base64,aGk="],
    ["a file URL", "file:///etc/passwd"],
    ["not a URL", "not a url"],
  ])("refuses %s", (_label, url) => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", undefined);

    expect(isAllowedAttachmentUrl(url)).toBe(false);
  });
});

describe("fetchAttachmentBytes", () => {
  it("returns the bytes of an allowed attachment and refuses redirects", async () => {
    const fetchSpy = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(bytesOf(5), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchSpy);

    const bytes = await fetchAttachmentBytes(OWN_STORE_URL);

    expect(bytes).toEqual(bytesOf(5));
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ redirect: "error" });
  });

  it("does not fetch a URL that is not on the Blob store", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(
      fetchAttachmentBytes("http://127.0.0.1:5432/")
    ).rejects.toMatchObject({ reason: "url_not_allowed" });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses a body whose Content-Length is over the cap", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(bytesOf(8), {
            status: 200,
            headers: { "content-length": "1000000" },
          })
      )
    );

    await expect(
      fetchAttachmentBytes(OWN_STORE_URL, { maxBytes: 100 })
    ).rejects.toMatchObject({ reason: "too_large" });
  });

  it("stops reading a body that grows past the cap without a Content-Length", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => chunkedResponse(1000, 64))
    );

    await expect(
      fetchAttachmentBytes(OWN_STORE_URL, { maxBytes: 100 })
    ).rejects.toMatchObject({ reason: "too_large" });
  });

  it("accepts a body exactly at the cap", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => chunkedResponse(2, 50))
    );

    const bytes = await fetchAttachmentBytes(OWN_STORE_URL, { maxBytes: 100 });

    expect(bytes.byteLength).toBe(100);
  });

  it("reports a non-2xx response as an http error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("gone", { status: 404 }))
    );

    await expect(fetchAttachmentBytes(OWN_STORE_URL)).rejects.toMatchObject({
      reason: "http_error",
    });
  });

  it("gives up when the download takes longer than the timeout", async () => {
    // A server that accepts the connection and never answers.
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(init.signal?.reason)
            );
          })
      )
    );

    const download = fetchAttachmentBytes(OWN_STORE_URL, { timeoutMs: 20 });

    await expect(download).rejects.toBeInstanceOf(AttachmentFetchError);
    await expect(download).rejects.toMatchObject({ reason: "timeout" });
  });

  it("rethrows the caller's own abort instead of calling it a timeout", async () => {
    const callerAbort = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(init.signal?.reason)
            );
          })
      )
    );

    const download = fetchAttachmentBytes(OWN_STORE_URL, {
      signal: callerAbort.signal,
    });
    callerAbort.abort(new DOMException("stopped", "AbortError"));

    await expect(download).rejects.toMatchObject({ name: "AbortError" });
  });
});
