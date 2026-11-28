import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import { OpenAPILink } from "@orpc/openapi-client/fetch";

import { V1_PREFIX, v1Contract } from "@/client/shared/api/contract";

export type ApiClient = ContractRouterClient<typeof v1Contract>;

/**
 * The base URL is read when a call is made, never at import time: client
 * components are also rendered on the server, where there is no origin.
 */
const resolveBaseUrl = (): string => {
  if (typeof location === "undefined") {
    throw new Error(
      [
        "The API client was called where there is no browser origin (server render).",
        "Call it from an effect or an event handler.",
      ].join(" ")
    );
  }

  return `${location.origin}${V1_PREFIX}`;
};

/**
 * Typed client for `/api/v1`.
 *
 * - Requests are same-origin, so the browser sends the session cookie with the
 *   default `fetch` credentials mode; `credentials: "include"` is not needed.
 * - Responses are deliberately not validated (no `ResponseValidationPlugin`):
 *   a page opened before a deploy must tolerate fields added later.
 */
export const api: ApiClient = createORPCClient<ApiClient>(
  new OpenAPILink(v1Contract, {
    url: resolveBaseUrl,
    // The link binds `globalThis.fetch` when it is built. Looking it up on each
    // call keeps later replacements of `fetch` (a polyfill, a test stub) working.
    fetch: (request, init) => globalThis.fetch(request, init),
  })
);
