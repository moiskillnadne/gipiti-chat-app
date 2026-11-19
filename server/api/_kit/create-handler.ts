import { OpenAPIHandler } from "@orpc/openapi/fetch";

import type { InitialContext } from "@/server/api/_kit/context";

type HandlerRouter = ConstructorParameters<
  typeof OpenAPIHandler<InitialContext>
>[0];

type CreateHandlerOptions = {
  /** The URL prefix the router is mounted at, for example `/api/v1`. */
  prefix: `/${string}`;
  getCookieSession: InitialContext["getCookieSession"];
  /** Served as JSON at `<prefix>/openapi.json`. */
  openApiDocument?: unknown;
};

type RouteHandler = (request: Request) => Promise<Response>;

type RouteHandlers = Record<
  "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD",
  RouteHandler
>;

const REQUEST_ID_HEADER = "x-request-id";
const OPENAPI_DOCUMENT_PATH = "/openapi.json";
/** A client may propose its own id; anything else is replaced by ours. */
const CLIENT_REQUEST_ID_PATTERN = /^[\w-]{8,64}$/;

const requestIdOf = (request: Request): string => {
  const proposed = request.headers.get(REQUEST_ID_HEADER);

  return proposed && CLIENT_REQUEST_ID_PATTERN.test(proposed)
    ? proposed
    : crypto.randomUUID();
};

/**
 * The answer for a request no procedure matches, in the same shape as every
 * other error. oRPC leaves this case to the route file; a known path called
 * with the wrong method ends up here as well.
 */
const notFoundResponse = (): Response =>
  Response.json(
    { defined: false, code: "NOT_FOUND", status: 404, message: "Not found." },
    { status: 404 }
  );

const withStandardHeaders = (
  response: Response,
  requestId: string
): Response => {
  const headers = new Headers(response.headers);
  headers.set("X-Request-Id", requestId);
  // Answers depend on who is calling; nothing in front may cache them.
  headers.set("Cache-Control", "no-store");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const withoutBody = (response: Response): Response =>
  new Response(null, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });

/**
 * Turn an oRPC router into the method handlers of a Next catch-all route.
 *
 * ```ts
 * export const { GET, POST, PUT, PATCH, DELETE, HEAD } = createHandler(router, {
 *   prefix: "/api/v1",
 *   getCookieSession,
 * });
 * ```
 */
export const createHandler = (
  router: HandlerRouter,
  { prefix, getCookieSession, openApiDocument }: CreateHandlerOptions
): RouteHandlers => {
  const handler = new OpenAPIHandler<InitialContext>(router);

  const answer = async (
    request: Request,
    requestId: string
  ): Promise<Response> => {
    const { pathname } = new URL(request.url);
    const isOpenApiRequest =
      openApiDocument !== undefined &&
      request.method === "GET" &&
      pathname === `${prefix}${OPENAPI_DOCUMENT_PATH}`;

    if (isOpenApiRequest) {
      return Response.json(openApiDocument);
    }

    const { matched, response } = await handler.handle(request, {
      prefix,
      context: { request, transport: "http", requestId, getCookieSession },
    });

    return matched ? response : notFoundResponse();
  };

  const handle: RouteHandler = async (request) => {
    const requestId = requestIdOf(request);

    if (request.method !== "HEAD") {
      return withStandardHeaders(await answer(request, requestId), requestId);
    }

    // No procedure is declared for HEAD, so the router would answer 404 for a
    // path that GET serves. HEAD gets what GET gets, minus the body.
    const getResponse = await answer(
      new Request(request, { method: "GET" }),
      requestId
    );

    return withoutBody(withStandardHeaders(getResponse, requestId));
  };

  return {
    GET: handle,
    POST: handle,
    PUT: handle,
    PATCH: handle,
    DELETE: handle,
    HEAD: handle,
  };
};
