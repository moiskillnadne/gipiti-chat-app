# Research: oRPC capabilities, `server/` layout, API versioning

Scope: input to the GIPITI oRPC / REST / FSD migration plan. Read-only research, no code changed.
Conventions: **[OBS]** = observed in a file or doc (cited), **[INF]** = my inference, **UNVERIFIED** = not
checked against types or docs. Repo paths are relative to `gipiti/app` unless prefixed `dashboard/`
(= `gipiti/admin-dashboard`). Paths under `dashboard/node_modules/.pnpm/...` are shortened to
`@orpc/<pkg>@1.15.7/dist/...`.

---

## 0. Things the plan must know first

1. **Version skew in the docs.** `orpc.dev` (the old `orpc.unnoq.com` now 301-redirects there) documents
   **oRPC 2.0 beta**: its install lines use `@beta`, and its AI SDK page uses renamed helpers
   (`streamToAsyncIteratorObject`, `asyncIteratorToStream`). [OBS: WebFetch of orpc.dev/docs/integrations/ai-sdk,
   /docs/openapi/plugins/zod-smart-coercion]. npm dist-tags: `latest` = **1.16.2**, `beta` = **2.0.0-beta.50**
   [OBS: registry.npmjs.org/@orpc/openapi]. The installed 1.15.7 exports the *old* names
   `streamToEventIterator`, `eventIteratorToStream`, `eventIteratorToUnproxiedDataStream`
   [OBS: `@orpc/server@1.15.7/dist/index.d.mts:6`].
   → **Pin `@orpc/*` to exact `1.16.2`, the same version for every package.** Verify APIs against the
   installed `.d.mts`, never against orpc.dev. Plan a separate, later "oRPC 2.0" upgrade task.
2. **Zod.** The app has **zod 3.25.76** [OBS: `node_modules/zod/package.json`, `package.json:85` `"^3.25.76"`].
   The dashboard uses zod ^4.6.7 [OBS: `dashboard/package.json:41`]. `@orpc/zod@1.16.2` has peer
   `zod >=3.25.0` and two entry points, `.` (Zod 3) and `./zod4` [OBS: unpkg `@orpc/zod@1.16.2/package.json`].
   `./zod4` exports `ZodToJsonSchemaConverter`, `JSON_SCHEMA_REGISTRY`, `JSON_SCHEMA_INPUT_REGISTRY`,
   `JSON_SCHEMA_OUTPUT_REGISTRY`, and a deprecated `experimental_ZodSmartCoercionPlugin`
   [OBS: unpkg `@orpc/zod@1.16.2/dist/zod4/index.d.mts`].
   → Recommendation: a prep PR that upgrades the app to Zod 4 (in line with the dashboard). Then every
   contract uses `import { z } from "zod"` with `@orpc/zod/zod4`. Fallback without the upgrade: write the
   contracts against the `zod/v4` subpath that 3.25 ships (UNVERIFIED that `@orpc/zod/zod4` accepts
   `zod/v4` schemas from a 3.25 install).
3. **`/api/usage-limits` is called but has no route.** `components/usage-limits-widget.tsx:74` fetches it,
   and no `app/**/usage-limits/route.ts` exists [OBS: `find app -name route.ts`]. This is either dead UI or
   a bug. Resolve it before mapping endpoints.
4. **Upload size versus the platform body limit.** `MAX_ATTACHMENT_BYTES = 10 MiB`
   (`lib/attachments/attachment-limits.ts:2`), and the upload route reads `request.formData()`
   (`app/(chat)/api/files/upload/route.ts:89`). Vercel Functions cap the request body at about 4.5 MB
   (UNVERIFIED, from memory). This matters for the mobile upload design (§1.9).

---

## 1. What oRPC offers (verified against installed 1.15.7 types plus 1.16.2 on unpkg)

### 1.1 Packages

| Package | Role | Inspected? |
|---|---|---|
| `@orpc/server` | builder `os`, `implement`, `call`, `createRouterClient`, `lazy`, `RPCHandler` (`/fetch`), plugins | yes, 1.15.7 (dashboard) |
| `@orpc/contract` | `oc` contract builder, `Route`, `ErrorMap`, `eventIterator` | yes, 1.15.7 |
| `@orpc/client` | `createORPCClient`, `RPCLink`, `ORPCError` | yes, 1.15.7 |
| `@orpc/tanstack-query` | `createTanstackQueryUtils` | yes, 1.15.7 (used in `dashboard/src/lib/orpc/client.ts`) |
| `@orpc/openapi` | `OpenAPIHandler` (`./fetch`), `OpenAPIGenerator` | **not in dashboard**; exports/types read on unpkg 1.16.2 |
| `@orpc/openapi-client` | `OpenAPILink` (client for an OpenAPI surface) | **not in dashboard**; only seen as a dependency of `@orpc/openapi@1.16.2` |
| `@orpc/zod` | JSON Schema converter for spec generation | **not in dashboard**; exports read on unpkg |
| `@orpc/json-schema` | smart coercion plugin | **not in dashboard**; dependency of `@orpc/zod@1.16.2` |
| `@orpc/experimental-react-swr` | SWR integration | **not in dashboard**; exists on npm at 1.16.2, API not inspected |

The dashboard has `client, contract, interop, server, shared, standard-server*, tanstack-query`
[OBS: `ls dashboard/node_modules/.pnpm | grep orpc`]. Missing, so not inspected locally:
**openapi, openapi-client, zod, json-schema, experimental-react-swr, and any AI SDK / React packages.**

### 1.2 Procedure builder [OBS: `@orpc/server@1.15.7/dist/index.d.mts:478-589`]

`Builder` has `$config`, `$context<T>()`, `$meta(initial)`, `$route(initial)`, `$input`, `middleware`,
`errors(map)`, `use(middleware)`, `meta`, `route(route)`, `input(schema)`, `output(schema)`,
`handler(fn)`, `prefix(path)`, `tag(...tags)` and `router(obj)`.
- `$route` sets defaults for every procedure built from that builder. `prefix()`/`tag()` apply to a
  router. **`.prefix()` is useful for versions**: a version prefix can come from the handler or from
  `os.prefix('/v1')`.
- `$context<T>()` declares the *initial* context, which the route handler supplies on every
  `handle(request, { context })`. `use()` middleware can extend that context (for example
  `{ session } → { user }`).
- Dashboard style today: router-first `os.input().output().handler()` with a plain-object router
  [OBS: `dashboard/src/server/orpc/overview.ts:37-51`, `router.ts:6-13`].

### 1.3 `Route` (HTTP mapping) [OBS: `@orpc/contract@1.15.7/dist/shared/contract.TuRtB1Ca.d.mts:59-179`]

`method`, `path`, `operationId` (default: joined router keys), `summary`, `description`,
`deprecated`, `tags`, `successStatus` (200–399), `successDescription`,
`inputStructure: 'compact' | 'detailed'`, `outputStructure: 'compact' | 'detailed'`, and `spec`
(override or transform the generated OperationObject).
- **Input sources.** `compact` (default) merges path params with either the query or the body,
  depending on the method. `detailed` passes `{ params, query, headers, body }` separately (:126-148).
  → Use `compact` by default. Use `detailed` only where a procedure must read request headers as
  validated input. Auth headers belong in the context, not in the input.
- **Output.** `detailed` lets a procedure return `{ status, headers, body }` (:149-173). Use it for 201
  responses with `Location`, or for per-response `Deprecation` headers.
- **Query typing.** Query values arrive as strings. In 1.16 the Zod 4 smart-coercion plugin is
  `experimental_` and deprecated (§0.2). → Use explicit `z.coerce.number()` / `z.stringbool()` in query
  schemas instead of the plugin. UNVERIFIED: how nested or array query params are encoded (bracket
  notation).

### 1.4 Typed errors and their REST form
- `ErrorMapItem = { status?, message?, data?: Schema }`, keyed by error code
  [OBS: `contract.TuRtB1Ca.d.mts:38-45`]. Declare errors with `.errors({ INSUFFICIENT_BALANCE: { status: 402, data: z.object({...}) } })`.
  Handlers receive typed constructors (`errors.INSUFFICIENT_BALANCE({ data })`).
- `ORPCError(code, { status?, message?, data?, cause? })`, with `toJSON()` returning
  `{ defined, code, status, message, data }` [OBS: `@orpc/client@1.15.7/dist/index.d.mts:104-132`].
  Built-in codes map to statuses 400/401/403/404/405/406/408/409/412/413/415/422/429/499/500 (:22-78).
  `Symbol.hasInstance` is patched for Next's multiple module graphs (:118-130). This is a real Next
  gotcha that oRPC already handles.
- Over REST, the body for an error is the JSON above, sent with the error's HTTP status (INF from
  `toJSON`; the exact OpenAPIHandler body is UNVERIFIED). The 1.16.2 generator supports
  `customErrorResponseBodySchema` [OBS: unpkg `@orpc/openapi@1.16.2/dist/shared/openapi.BGy4N6eR.d.mts`].
- Today's REST error body is `{ code, message, cause }` from `ChatSDKError.toResponse()` [OBS:
  `lib/errors.ts:56-75`]. → v1 adopts the oRPC shape. Map domain errors (`ChatSDKError`) to `ORPCError`
  in one place, the way the dashboard does in `callService` [OBS: `dashboard/src/server/orpc/errors.ts:16-31`].
  The web client must stop parsing `ChatSDKError` JSON for v1 calls.
- Versioning consequence: error codes are part of the contract. **Policy: output error-code sets and
  output enums are open-ended. Clients must handle an unknown code generically.** Write this into the v1
  docs before the first mobile build ships.

### 1.5 RPCHandler versus OpenAPIHandler
- `RPCHandler` (`@orpc/server/fetch`) uses oRPC's own wire protocol, so only oRPC clients can call it.
  `handle(request, { prefix, context })` returns `{ matched, response }`
  [OBS: `dashboard/src/app/rpc/[[...rest]]/route.ts:1-21`; `prefix?: HTTPPath` in
  `@orpc/server@1.15.7/dist/shared/server.BqadksTP.d.mts:34`].
- `OpenAPIHandler` (`@orpc/openapi/fetch`) has the same `handle(request, { prefix, context })` shape
  and its options extend `FetchHandlerOptions` [OBS: unpkg `@orpc/openapi@1.16.2/dist/adapters/fetch/index.d.mts`;
  doc snippet with `prefix: '/api'` on orpc.dev/docs/openapi/openapi-handler (v2 docs)]. It serves the
  `Route` method and path mapping as plain REST.
- No Next-specific adapter exists: the fetch adapter's handler is exported from `route.ts` as GET, POST,
  PUT, PATCH, DELETE and HEAD, exactly as the dashboard does.
- Useful server plugins in 1.15.7: `CORSPlugin`, `RequestHeadersPlugin` (puts `reqHeaders` into the
  context), `ResponseHeadersPlugin` (puts `resHeaders` into the context), `BatchHandlerPlugin`,
  `SimpleCsrfProtectionHandlerPlugin`, `StrictGetMethodPlugin` and `experimental_RethrowHandlerPlugin`
  [OBS: `@orpc/server@1.15.7/dist/plugins/index.d.mts:73-192`]. In 1.15 the CSRF and strict-GET plugins
  are documented for the RPC protocol. Whether they apply to OpenAPIHandler is UNVERIFIED.
- **Decision: one `OpenAPIHandler` per API version, and the web client also uses it through `OpenAPILink`.**
  Web and mobile then exercise the same surface, so every web E2E test also tests the mobile API.
  - *Alternative that lost:* a second `RPCHandler` at `/api/rpc` for the web. It gives richer
    serialisation (Date, Map, BigInt), but it means two surfaces, two sets of tests, and a web client
    that drifts from what mobile sees. Rule that follows: **v1 schemas use JSON-native types only**
    (ISO strings for dates, integer minor units for money, no Date/BigInt/Map).
  - Caveat: `OpenAPILink` needs the contract object at runtime (`new OpenAPILink(contract, …)` in the v2
    docs; the 1.16 signature is UNVERIFIED). The contract ships zod schemas to the browser, so keep it lean.

### 1.6 OpenAPI spec generation
- `import { OpenAPIGenerator } from '@orpc/openapi'` and `ZodToJsonSchemaConverter` from `@orpc/zod/zod4`.
  `OpenAPIGeneratorOptions.schemaConverters?: ConditionalSchemaConverter[]`.
  `generate(router|contract, options)`, where the options extend `Partial<Omit<OpenAPI.Document,'openapi'>>`
  (so `info`, `servers` and friends are passed directly) plus `filter` (`exclude` is deprecated),
  `commonSchemas` (named `$ref` components, with a `strategy` choosing input or output) and
  `customErrorResponseBodySchema`
  [OBS: unpkg `@orpc/openapi@1.16.2/dist/shared/openapi.BGy4N6eR.d.mts`, `@orpc/openapi@1.16.2/dist/index.d.mts`].
  The v2 docs show `version: '3.2.0'` as the default and `errorStatusMap`. **The 1.16 default OpenAPI
  version is UNVERIFIED.** Pin 3.1.x explicitly if the option exists, for compatibility with diff tools
  and codegen.
- Event iterators are documented as `text/event-stream` (`toOpenAPIEventIteratorContent` is exported)
  [OBS: same index.d.mts]. `isFileSchema` is exported, which suggests file schemas map to multipart (INF).

### 1.7 Contract-first versus router-first
- `@orpc/contract` (`oc`) declares route, input, output and errors with **no handler and no server
  imports**. `implement(contract)` in `@orpc/server` enforces the implementation against it
  [OBS: `declare function implement` in `@orpc/server@1.15.7/dist/index.d.mts`].
- **Decision: contract-first for the public API (`server/api/v1/**/contract.ts`).** Reasons:
  1. A contract tree has no dependencies on drizzle, NextAuth, the AI SDK or Redis, so it can be bundled
     into the browser (`OpenAPILink`) and later published as a package (for example `@gipiti/api-v1`)
     for an Expo app. With router-first, `typeof router` pulls in the server's whole type graph, and a
     React Native repo outside this repo cannot use it without the server sources.
  2. A frozen contract is the versioning artefact: the spec is generated from it and its diff is
     reviewed (§4).
  3. Native clients only need the OpenAPI spec, which works with either style.
  - *Alternative that lost:* router-first, as the dashboard does today. It is less ceremony, but it
    leaks server types and has no separate frozen artefact. Router-first stays fine for internal-only
    procedures.

### 1.8 Streaming and the AI SDK
- `eventIterator(yieldSchema, returnSchema?)` [OBS: `@orpc/contract@1.15.7/dist/index.d.mts:309`]. The
  fetch standard-server encodes event iterators as SSE (`text/event-stream` in
  `@orpc/standard-server-fetch@1.15.7/dist/index.mjs`) [OBS: grep].
- AI SDK bridge helpers in 1.15.7: `streamToEventIterator` and `eventIteratorToUnproxiedDataStream`
  [OBS: index.d.mts:6]. The v2 docs pattern: return `streamToAsyncIteratorObject(result.toUIMessageStream())`
  from a procedure, and on the client a custom `useChat` transport. **`reconnectToStream` is unsupported
  by default** [OBS: orpc.dev ai-sdk page].
- **Decision: keep `POST` chat streaming as a raw Next route on the AI SDK UI-message-stream protocol**
  (the working assumption holds). Evidence:
  - The route depends on `after()`, `maxDuration = 800`, a Redis turn slot, resumable streams and
    `JsonToSseTransformStream` [OBS: `app/(chat)/api/chat/route.ts:1-2,45,104`].
  - The resume endpoint also uses 800 s [OBS: `app/(chat)/api/chat/[id]/stream/route.ts:14`].
  - The web build ships fonts with this function through `outputFileTracingIncludes` keyed by
    `"/api/chat"` [OBS: `next.config.ts:88`].
  - oRPC's AI SDK path loses resumption, and its SSE framing would differ from what `useChat`'s default
    transport expects (INF). An Expo client can use the AI SDK's own `useChat` against the raw endpoint
    (UNVERIFIED for React Native).
  - The raw route is documented in the spec by post-processing the generated document (adding its
    `paths` entry by hand). Whether `generate()`'s `paths` option merges or replaces is UNVERIFIED, so do
    not rely on it.
  - *Alternative that lost:* an oRPC event-iterator procedure. It is typed end to end, but it loses
    resumption, `after()` integration and the per-function config, and it rewrites the riskiest
    real-money code path.

### 1.9 File uploads
oRPC accepts `File`/`Blob` in input and serialises it as multipart (multipart and FormData handling is
present in `@orpc/standard-server*` and `@orpc/client` [OBS: grep]; `isFileSchema` in openapi). That
does not lift the platform body cap (§0.4).
→ For v1 upload, prefer a two-step flow: `POST /api/v1/uploads` returns a client-upload token, the
client uploads directly to Vercel Blob, then the client confirms. Keep the current multipart route for
the web until then. Owner decision; the blob client-token API is UNVERIFIED here.

### 1.10 Direct invocation (Server Components and tests)
`call(procedure, input, { context })` [OBS: index.d.mts:787] and `createRouterClient(router, { context })`
[OBS: :797]. → **RSC pages should call domain modules (`server/modules/*`) directly, not procedures.**
Procedures are transport. Tests use `call()` with a fake context for procedure logic, and
`handler.handle(new Request(...))` for HTTP-shape tests (§1.13).

### 1.11 Data fetching: SWR versus TanStack Query
The app uses `swr ^2.2.5` [OBS: `package.json:78`] in 12 files [OBS: grep `useSWR|from "swr"`].
- **Decision: keep SWR on the web** and use typed client calls as fetchers
  (`useSWR(key, () => api.chats.list(input))`). This adds no new dependency.
  `@orpc/experimental-react-swr` exists but is experimental. TanStack Query is the likely choice for an
  Expo app, and the mobile app chooses independently because it consumes the spec or contract.
- *Alternative that lost:* migrating the web to `@orpc/tanstack-query` (the dashboard's choice). That is
  churn across 12 files with no mobile benefit, so do it later if ever.

### 1.12 Lazy routers and bundle size
`lazy(() => import(...))` exists. Its JSDoc warns that `meta.prefix` does not apply a prefix, so use
`os.prefix(...).lazy(...)` [OBS: `@orpc/server@1.15.7/dist/shared/server.qKsRrdxW.d.mts:33-37`].
- [INF] Lazy loading defers module *evaluation*, which helps cold-start init time. It does not shrink
  the function bundle, because the bundler still traces the dynamic imports into the same function.
  How lazy routers combine with `implement(contract)` is UNVERIFIED.

### 1.13 Per-route Next config versus a catch-all
`maxDuration`, `runtime` and `dynamic` are per `route.ts` file. A single catch-all is **one function
with one config** [OBS: route segment exports `app/api/webhooks/cloudpayments/route.ts:20` (25 s) and
`app/(chat)/api/chat/route.ts:45` (800 s)]. Consequences:
- Long-running endpoints (chat turn, stream resume, and synchronous image or video generation if any is
  added) get their own `route.ts`. The catch-all keeps a modest `maxDuration` (for example 60).
- **Route precedence trap [INF from App Router semantics; verify in a spike].** A specific
  `app/api/v1/chats/[id]/messages/route.ts` *owns every method on that path*. If the oRPC contract also
  defines `GET /chats/{id}/messages`, that request would reach the raw route file and get 405 instead of
  the catch-all. Rule: a raw route file must either own a path no procedure uses, or forward its other
  methods to the shared oRPC handler (`export const GET = handleV1`).

---

## 2. Next.js mechanics: where the URL prefix and route files live

### 2.1 Decision: (a) one optional catch-all per version, `app/api/v1/[[...rest]]/route.ts`, plus thin raw routes for long or streaming endpoints

The catch-all calls `new OpenAPIHandler(v1Router, { plugins: [...] }).handle(req, { prefix: "/api/v1", context })`,
exactly like `dashboard/src/app/rpc/[[...rest]]/route.ts`.
- *Alternative (b): a `route.ts` per endpoint re-exporting handlers from `server/`.* It lost because:
  - It duplicates the HTTP router that oRPC already is (method and path matching, 404/405).
  - It means about 30 or more trivial files under `app/api/v1/**`, which must be kept in sync with the
    contract paths, with no compiler check that they match.
  - Every new endpoint touches two trees.
  - Its one advantage, per-endpoint functions with their own config and smaller cold starts, is captured
    by the "raw route for long or streaming endpoints" exception above.
  - [INF] At this API's size (about 30 small DB-bound procedures), one warm Fluid-compute function is
    likely *better* for cold starts than 30 rarely used ones. Whether Vercel groups same-config Next
    routes into one function is UNVERIFIED.
- The mirroring the owner asked for is achieved in `server/api/v1/**` (§3), not in `app/`.

### 2.2 Decision: prefix `/api/v1`, not `/v1`
- `proxy.ts` matcher: the catch-all pattern excludes `api/` [OBS: `proxy.ts:153`]. Under `/api/v1`,
  the proxy's session redirect, signup gate and markdown rewrite never run, and auth happens in oRPC
  middleware (returning 401 JSON, not a 302 to `/login`). A root `/v1/...` would be matched, would run
  `getToken` on every API call, and could be redirected [OBS: `proxy.ts:112-137`].
- `next.config.ts:21` `HTML_PAGE_SOURCE = "/((?!api/|_next/|images/|videos/).*)"` adds the
  agent-discovery `Link` header to everything outside `api/`. `/v1` responses would get HTML `Link`
  headers.
- `app/robots.txt/route.ts` disallows `/api/` [OBS: `DISALLOWED_PATHS`]. `/v1` would need a new entry.
- No collisions: there are no root-level dynamic segments (`(marketing)` has `models/[slug]` and
  `blog/[slug]`; `(legal)` has `legal/*`) [OBS: `find app/(marketing) app/(legal)`]. `/api/v1` is unused.
- `vercel.json` cron paths are `/api/cron/*` [OBS: `vercel.json`]. They are unaffected.
- The current `proxy.ts:96-102` allow-list (`/api/auth`, `/api/webhooks`, `/api/payment`, `/api/log`) is
  dead code for the matcher, since `api/` is already excluded [INF]. Mention it as a cleanup, not a risk.
- The public spec today is `/openapi.json`, listing only `/api/health` [OBS:
  `lib/agent-discovery/openapi.ts:69-71`]. `docs/agent-discovery.md:76-85` deliberately does not publish
  session-authenticated APIs. → Serve the v1 spec at `/api/v1/openapi.json` and leave `/openapi.json`
  and `/.well-known/api-catalog` unchanged. Whether to *link* v1 from the api-catalog is an **owner
  decision** that reverses a documented policy. [INF] Any shipped mobile binary exposes the API anyway,
  so hiding the spec buys no security.
- *Alternative that lost:* `/v1` at the root. It gives a prettier URL, but it needs proxy matcher,
  `Link` header and robots changes, and it shares a namespace with marketing pages.

### 2.3 Paths that must keep their exact URLs (externally dictated or already published)
- `/api/webhooks/cloudpayments` (`maxDuration` 25) and `/api/webhooks/resend`. These URLs are configured
  in the providers' dashboards.
- `/api/cron/{reset-quotas,cleanup-cancelled,refresh-fx-rates}` [OBS: `vercel.json`] and
  `/api/cron/cleanup-payment-intents`, which exists as a route but is **not scheduled in `vercel.json`**
  [OBS]. Check whether it is triggered elsewhere.
- `/api/auth/[...nextauth]` (the web cookie flow, used by `next-auth/react`; a client calls
  `/api/auth/session`).
- `/api/health` (published in `openapi.json` and the api-catalog), `/api/log` (web client logging) and
  `/api/agent-markdown/*` (the rewrite target of `proxy.ts:63-65`).
- `/.well-known/*`, `/openapi.json`, `/robots.txt`.
- These remain as `app/**/route.ts` files whose bodies delegate to `server/webhooks/*`, `server/cron/*`
  and `server/agent-discovery/*`.

---

## 3. Proposed `server/` layout

### 3.1 Principles
1. `server/api/<version>/**` is **transport only**: contract, procedure and the version's mappers. It
   mirrors the URL path, as the owner asked.
2. `server/modules/<domain>/**` holds **version-independent business logic**: services, queries and
   domain errors. A v2 endpoint reuses the same module through a different mapper.
3. `server/{db,integrations,webhooks,cron,http,agent-discovery}` cover the remaining server concerns.
4. Isomorphic code (types, zod primitives, constants, i18n, pure formatters) lives in the FSD
   **`src/shared`** layer. `server/**` may import `src/shared/{config,lib,i18n,types}` and nothing else
   from `src/`. Client code may import from `server/` **only** the version contract entry
   (`@/server/api/v1/contract`), plus type-only imports listed in §3.6.
5. FSD root: `src/` holds FSD layers (`_app`, `_pages`, `widgets`, `features`, `entities`, `shared`).
   Next `app/` stays at the repo root and re-exports `_pages`. FSD's official Next guide renames
   `app`/`pages` to `_app`/`_pages`, says *"the `src` folder contains only FSD code"*, and suggests
   `index.server.ts` for server-only slice exports [OBS: feature-sliced.design/docs/guides/tech/with-nextjs].
   Because the server lives in `server/` rather than in FSD's `_app/api-routes` segment, the guide's
   own caveat applies: FSD is for frontends, so the backend is a separate package-like tree.

### 3.2 Tree

```
app/                                   # Next routing only: page.tsx re-exports src/_pages; route.ts files are 1–5 lines
  api/
    v1/
      [[...rest]]/route.ts             # OpenAPIHandler(v1Router) prefix /api/v1, maxDuration 60
      chats/[id]/turns/route.ts        # raw: POST stream (AI SDK), maxDuration 800; other methods -> handleV1
      chats/[id]/turns/stream/route.ts # raw: GET resume SSE, maxDuration 800
      openapi.json/route.ts            # serves server/api/v1/openapi.snapshot.json
    auth/[...nextauth]/route.ts        # web cookie flow (kept URL)
    webhooks/{cloudpayments,resend}/route.ts
    cron/<job>/route.ts
    health/route.ts  log/route.ts  agent-markdown/[[...path]]/route.ts
  .well-known/**  openapi.json/  robots.txt/  (unchanged URLs)
server/
  api/
    _kit/                              # version-agnostic transport building blocks
      context.ts                       # InitialContext { request headers, client info }
      base.ts                          # os.$context<…>() + error-mapping middleware
      middleware/
        auth.ts                        # session from cookie OR Bearer -> context.user (401 otherwise)
        client-version.ts              # X-Client-Version / platform -> 426 CLIENT_UPGRADE_REQUIRED
        deprecation.ts                 # Deprecation/Sunset headers from meta (ResponseHeadersPlugin)
        rate-limit.ts
      errors.ts                        # ChatSDKError/domain errors -> ORPCError (dashboard callService pattern)
      common-errors.ts                 # shared ErrorMap fragments (UNAUTHORIZED, INSUFFICIENT_BALANCE…)
      create-handler.ts                # factory: (router, prefix) -> Next route handler
      openapi.ts                       # generator factory (converters, info, raw-route path patching)
    v1/
      contract.ts                      # aggregates all v1 contracts (ISOMORPHIC entry, the only client import)
      router.ts                        # implement(contract).router({...}) aggregating procedures
      openapi.snapshot.json            # committed spec (generated; CI-diffed)
      __tests__/openapi-snapshot.test.ts
      auth/
        login/{contract.ts,procedure.ts,__tests__/procedure.test.ts}
        refresh/…  logout/…  register/…  verify-email/…  password-reset/…
      me/{contract.ts,procedure.ts}               # GET /me
      me/preferences/{contract.ts,procedure.ts}   # replaces cookie server actions
      chats/{contract.ts,procedure.ts,mappers.ts} # GET list (history), DELETE all
      chats/[id]/{contract.ts,procedure.ts}       # GET, DELETE
      chats/[id]/messages/…                       # GET list, DELETE trailing (deleteTrailingMessages)
      chats/[id]/votes/…  chats/[id]/stop/…
      chats/[id]/turns/route-handler.ts           # raw handler (re-exported by app/api/v1/chats/[id]/turns/route.ts)
      projects/…  projects/[id]/files/…  projects/[id]/files/[fileId]/…
      prompts/…  prompts/[id]/favorite/…  quizzes/[key]/…
      subscription/…  subscription/resume/…  subscription/cancellation-feedback/…
      payments/intents/… topups/intents/…  transactions/…  usage/…  uploads/…
      app-config/{contract.ts,procedure.ts}       # public: min/latest app versions (§4.5)
  modules/                             # domain, version-independent; no oRPC, no Request/Response
    auth/  billing/  subscription/  chat/  chat-turn/  ai/  projects/  prompts/  quiz/
    users/  activity/  payments/  email/  blog/
      <module>/{service files}.ts, queries/*.ts, errors.ts, __tests__/
  db/                                  # schema.ts, connection.ts, migrate.ts, migrations/, utils.ts, unique-violation.ts
  integrations/                        # thin clients for 3rd parties
    ai-gateway/ (providers.ts)  cloudpayments/  resend/  tavily/  recraft/  redis/  blob/
  webhooks/{cloudpayments,resend}/handler.ts
  cron/{reset-quotas,cleanup-cancelled,cleanup-payment-intents,refresh-fx-rates}/handler.ts
  http/                                # helpers for the non-oRPC routes (handle-route-error, rate-limit)
  agent-discovery/                     # openapi.ts (public), api-catalog, skills, markdown generation
  flags.ts  env.ts
src/                                   # FSD (client) + isomorphic shared
  _app/ _pages/ widgets/ features/ entities/ shared/{ui,lib,config,i18n,api,types}
```

**Resource naming.** I propose REST plural resources (`/chats`, `/chats/{id}/messages`). The owner's
example `/v1/chat/history` maps to `GET /api/v1/chats`. The exact names are the owner's call. The layout
works the same either way.

**Path-param folders** use the Next-style `[id]`, which is familiar and harmless outside `app/`. The
router key is the folder path in camelCase (`chats.byId.messages.list`) and gives the `operationId`.

### 3.3 Files inside an endpoint folder (kebab-case, as in the repo conventions)

| File | Contents | Imports allowed |
|---|---|---|
| `contract.ts` | `oc.route({ method, path, summary, tags }).input().output().errors()` for **every method on this path**, plus their zod schemas and inferred types | `zod`, `@orpc/contract`, `src/shared/*`, `server/api/_kit/common-errors` (must itself stay isomorphic) |
| `procedure.ts` | `impl.<key>.use(authMiddleware).handler(({ input, context, errors }) => …)`, calling `server/modules/*` and mapping results | anything server-side |
| `mappers.ts` (optional) | domain → v1 DTO mapping; where a v2 diverges | domain types and contract types |
| `route-handler.ts` (only for raw endpoints) | `(req: Request) => Response` for streaming or long work | anything server-side |
| `__tests__/procedure.test.ts` | `call()`-based tests with a fake context and mocked modules | — |
| `__tests__/http.test.ts` (selective) | `OpenAPIHandler.handle(new Request(…))`: status codes, error bodies, coercion | — |

No `index.ts` barrels inside endpoints. Aggregation happens only in `<resource>/router.ts` (when a
resource has many children) and in `v1/{contract,router}.ts`. Vitest already collects
`**/__tests__/**/*.test.ts` [OBS: `vitest.config.ts:8`].

### 3.4 Boundary enforcement
- Biome 2.2.2 is in use [OBS: `package.json:88`]. Whether its `noRestrictedImports` supports
  per-directory overrides strong enough for these rules is UNVERIFIED. → Add a unit test,
  `server/api/__tests__/boundaries.test.ts`, that scans import specifiers with a regex and asserts:
  - `**/contract.ts` imports nothing from `server/` except `_kit/common-errors`, and nothing from `db`,
    `next`, `next-auth` or `ai`;
  - `src/**` imports `@/server/**` only as `@/server/api/v1/contract` or type-only;
  - `server/modules/**` never imports `@orpc/*`, `next/*` or `src/{_app,_pages,widgets,features,entities}`.
- `import "server-only"` at the top of `server/modules/*` entry files, and `src/shared/*` must not import
  `server/`. Whether the `server-only` package is installed is UNVERIFIED. dependency-cruiser is the
  heavier alternative. It lost: a new tool, where a 40-line test does the job.

### 3.5 Mapping: current folders → new home
(✱ = imported by a `"use client"` file, so it must be isomorphic or split [OBS: tally over the 167
client files listed in `scratchpad/orpc-plan/client-files.txt`].)

| Current | New home |
|---|---|
| `lib/activity` | `server/modules/activity` |
| `lib/agent-discovery` (openapi, api-catalog, skills, markdown) | `server/agent-discovery`; `markdown/paths.ts` is imported by `proxy.ts`, keep it edge-safe |
| `lib/agent-discovery/webmcp-tools` ✱ | `src/features/webmcp/` |
| `lib/ai/models.ts` ✱(13), `model-capability` ✱, `model-speed` ✱, `entitlements` ✱ | `src/shared/config/ai-models/` (isomorphic registry, read by server too) |
| `lib/ai/providers.ts`, `recraft-client.ts` | `server/integrations/ai-gateway/`, `server/integrations/recraft/` |
| `lib/ai/{prompts,tools/*,generate-*,docx-*,pdf-*,markdown-to-*,watermark,media-upload,text-attachments,message-validator,step-calculator,resolve-latest-image,generate-chat-title}` | `server/modules/ai/` |
| `lib/api/handle-route-error.ts` | `server/http/` |
| `lib/attachments` ✱ | `src/shared/lib/attachments/` |
| `lib/auth` (normalize-email, reset-token, secret) | `server/modules/auth/`; `secret.ts` is also used by `proxy.ts` |
| `lib/billing` (balance, fx, refund, spend, turn-*, subscriptions, payment-history, email-verification, tester-plans, currencies) | `server/modules/billing/` |
| `lib/billing/money.ts` ✱, `constants.ts` ✱ | split: pure formatting → `src/shared/lib/money/`; client-visible constants → `src/shared/config/billing.ts`; the rest stays in the module |
| `lib/blog` (posts.ts reads fs) | `server/modules/blog/` |
| `lib/blog/{schema,types,slug,format,frontmatter,reading-time}` ✱ | `src/entities/blog-post/model/` |
| `lib/chat/delete-trailing-messages.ts` | `server/modules/chat/` |
| `lib/chat/input-draft.ts` ✱ | `src/features/compose-message/lib/` |
| `lib/db/{schema,connection,migrate,migrations,utils,unique-violation}` | `server/db/` (update `drizzle.config.ts`, the `build` script and `db:*` scripts) |
| `lib/db/query/<domain>` (activity, chat, document, project, prompt, quiz, subscription, user) | `server/modules/<domain>/queries/` |
| `lib/db/schema` type imports ✱(10: `Project`, `Chat`, `Vote`, `Prompt`, `ProjectFile`) | replaced by contract output types (`z.infer`), so the client stops importing drizzle types |
| `lib/dom` ✱ | `src/shared/lib/dom/` (the GIPITI-101 guard, keep it) |
| `lib/email/client.ts` | `server/integrations/resend/` |
| `lib/email/{send-*,templates,forward-email,add-contact-to-segment}` | `server/modules/email/` |
| `lib/geo` | `server/modules/auth/` |
| `lib/i18n` ✱(86) | `src/shared/i18n/` (server imports `getTranslations` from there) |
| `lib/marketing` ✱ | `src/entities/model-catalog/` and `src/widgets/landing/model/`; also read by `server/agent-discovery/markdown` |
| `lib/media` ✱, `lib/messages` ✱ | `src/entities/message/lib/` |
| `lib/payments/{cloudpayments,cloudpayments-config}.ts` | `server/integrations/cloudpayments/` |
| `lib/payments/{cloudpayments-widget,cloudpayments-types}` ✱ | `src/features/payment/lib/` (DTO types come from the contract) |
| `lib/prompts/prompt-meta` ✱ | `src/entities/prompt/model/` |
| `lib/prompts/{prompt-seed,prompt-sheet,prompt-sync}` | `server/modules/prompts/` |
| `lib/quiz` ✱(types) | `src/entities/quiz/model/` (registry is isomorphic) |
| `lib/rate-limit.ts` | `server/http/rate-limit.ts` |
| `lib/redis.ts` | `server/integrations/redis/` |
| `lib/search/tavily-client.ts` | `server/integrations/tavily/` |
| `lib/search/search-types` ✱ | `src/shared/types/` or the contract |
| `lib/seo` | `src/shared/config/seo/` |
| `lib/styles-projects/templates` ✱ | `src/entities/project/config/` |
| `lib/subscription/{billing-periods,get-latest-subscription,is-free-user,period-end-action,resume-subscription,subscription-init}` | `server/modules/subscription/` |
| `lib/subscription/use-cancel-subscription.ts` (a `"use client"` hook in `lib/`) | `src/features/cancel-subscription/model/` |
| `lib/subscription/{subscription-state,cancellation-reasons}` ✱ | `src/entities/subscription/model/` |
| `lib/subscription/subscription-tiers.ts` ✱ | stays seed-only in `server/modules/subscription/seed/`. **Fix the client import** in `app/subscription/_components/plans-grid-card.tsx:5`: a "seed-only" file read at runtime by the client contradicts CLAUDE.md |
| `lib/utils/*` ✱, `lib/utils.ts` ✱(71), `url.ts` ✱, `download.ts` ✱, `format-tokens.ts`, `usage.ts` ✱ | `src/shared/lib/` (split `utils.ts`: `cn`, `fetcher`, uuid) |
| `lib/utm/constants` ✱ / `parse-utm-cookie` | `src/shared/config/utm.ts` / `server/modules/auth/` |
| `lib/validation/password` ✱ | `src/shared/lib/validation/` (reused by the auth contracts) |
| `lib/validation/{subscription-intent,topup}` | the contracts `payments/intents/contract.ts` and `topups/intents/contract.ts` |
| `lib/client-logger.ts` ✱, `client-diagnostics.ts` ✱ | `src/shared/lib/logging/` |
| `lib/constants.ts` | split: `src/shared/config/env-flags.ts` (isomorphic) and `server/env.ts` |
| `lib/errors.ts` ✱ | `ChatSDKError` → `server/modules/_shared/errors.ts`; the client-side error-code helpers → `src/shared/api/errors.ts` |
| `lib/flags.ts` | `server/flags.ts` (used by `proxy.ts`) |
| `lib/types.ts` ✱(14) | `src/entities/message/model/types.ts`. It uses **type-only** imports of the server tools for `InferUITool` [OBS: `lib/types.ts:3-10`], an allowed exception (§3.6). Payment and Prompts response types move to the contracts |
| `components/`, `hooks/`, `contexts/` | FSD `src/{widgets,features,entities,shared/ui}` (the FSD researcher maps these) |
| `app/(auth)/actions.ts` (login, register, verifyEmail, resendVerificationCode, requestPasswordReset, resetPassword) [OBS: :61-412] | `server/api/v1/auth/*` plus `server/modules/auth/*`. The web forms call v1 |
| `app/(chat)/actions.ts` (11 cookie setters plus `deleteTrailingMessages`) [OBS: :19-89] | `PATCH /api/v1/me/preferences` (needs a decision: DB-persisted versus client-local) and `DELETE /api/v1/chats/{id}/messages?after=` |
| `app/(auth)/auth.ts`, `auth.config.ts` | `server/modules/auth/next-auth.ts`; `app/api/auth/[...nextauth]/route.ts` re-exports the handlers |
| `app/(chat)/api/chat/route.ts` plus `_lib/*` (about 20 files) | `server/modules/chat-turn/*` (domain: prepare, enforce-balance, handlers, charge, persist, turn-slot) plus `server/api/v1/chats/[id]/turns/route-handler.ts` |
| `app/(chat)/api/chat/[id]/stop` | `POST /api/v1/chats/{id}/stop` (oRPC) |
| `app/(chat)/api/chat/[id]/stream` | raw `GET /api/v1/chats/{id}/turns/stream` |
| `app/(chat)/api/history` (GET, DELETE) | `GET`/`DELETE /api/v1/chats` |
| `app/(chat)/api/vote` | `/api/v1/chats/{id}/votes` |
| `app/(chat)/api/files/upload` | `/api/v1/uploads` (§1.9) |
| `app/(chat)/api/projects/**` | `/api/v1/projects/**` |
| `app/(chat)/api/prompts`, `prompts/favorite` | `/api/v1/prompts`, `/api/v1/prompts/{id}/favorite` |
| `app/(chat)/api/quiz/[key]` | `/api/v1/quizzes/{key}` |
| `app/(chat)/api/subscription/{,resume,cancellation-feedback}` | `/api/v1/subscription/**` |
| `app/(chat)/api/{transactions,usage}` | `/api/v1/transactions`, `/api/v1/usage` |
| `app/api/me` | `GET /api/v1/me` |
| `app/api/payment/{create-intent,status}`, `app/api/topup/create-intent` | `/api/v1/payments/intents`, `/api/v1/topups/intents` (the web CloudPayments widget only; mobile payments are out of scope) |
| `app/api/webhooks/*`, `app/api/cron/*` | URL kept; bodies → `server/webhooks/*`, `server/cron/*` |
| `app/api/{health,log,agent-markdown}`, `app/.well-known/*`, `app/openapi.json`, `app/robots.txt` | URL kept; logic → `server/agent-discovery`, `server/http` |

### 3.6 Modules imported by both client and server (top counts) [OBS: client-import tally]
`i18n/translate` (86), `utils` (71), `types` (14), `ai/models` (13), `db/schema` (10, all `import type`),
`marketing/landing-content` (7), `client-logger` (5), `prompts/prompt-meta`, `client-diagnostics`,
`blog/schema`, `attachments/attachment-display` (4 each), `billing/money`, `usage`, `url`, `download`,
`media/collect-chat-media`, `utils/swatch` (3 each), and about 25 more with 1–2 imports each
(`billing/constants`, `subscription/subscription-state`, `validation/password`, …).

Allowed type-only exceptions from client to server: `ChatMessage`'s `InferUITool<typeof tool>` (from
`server/modules/ai/tools`) and contract-inferred DTOs. Everything else that crosses the boundary must
live in `src/shared` or `src/entities`.

---

## 4. Versioning policy and mechanics

### 4.1 Mechanism: URL major version
`/api/v1`, `/api/v2`, …, with one `[[...rest]]` catch-all and one OpenAPIHandler per version. Contract
paths are **relative** (`/chats`), and the version prefix comes from `handle(req, { prefix: "/api/v1" })`,
so a procedure object can be mounted under several versions unchanged (INF from the plain-object router,
`dashboard/src/server/orpc/router.ts:6-11`).
- *Alternative that lost:* header or media-type versioning (`Accept: application/vnd.gipiti.v2+json`).
  It is invisible in logs and caches, awkward to put in OpenAPI, and does not map onto the owner's
  folder-per-version layout.

### 4.2 What is breaking within a version (forbidden in v1 once a mobile build ships)
- Removing or renaming an endpoint, method, field, query param or header.
- Changing a field's type, format, unit or meaning (for example major to minor money units, or an ISO
  string to epoch).
- Making an input field required, or tightening validation (min/max, regex, a narrower enum).
- Removing an input enum value.
- Output: removing a field, making a non-null field nullable or optional, removing a value from an output
  enum.
- Changing a success status code or the status of an existing error code; removing or renaming an error
  code; changing auth requirements; changing default pagination or order.

### 4.3 Additive changes (allowed in v1)
- New endpoints.
- New **optional** input fields, and widening validation.
- New output fields.
- New output enum values and new error codes, allowed **only because** v1 documents them as open sets
  and the mobile client has unknown-value fallbacks from day one (§1.4).
- Clients must ignore unknown output fields. Do not validate output strictly on mobile, or use zod
  `.loose()`/non-strict objects in client parsing (UNVERIFIED: the default output-validation behaviour of
  `OpenAPILink`).

### 4.4 v2 coexistence
- `server/api/v2/` contains **only the endpoints that changed**. `v2/contract.ts` is built by spreading
  the v1 contract and overriding the changed keys, and `v2/router.ts` spreads the v1 router and overrides
  the same keys (`{ ...v1Router, chats: { ...v1Router.chats, list: v2ChatsList } }`). Then add
  `app/api/v2/[[...rest]]/route.ts` and a `v2/openapi.snapshot.json`.
- [INF] Spreading works with `implement(contract).router()` because routers are plain objects. Confirm in
  the spike that the types accept spread overrides, and that removing an endpoint in v2 (omitting a key)
  typechecks.
- Business logic stays in `server/modules/*`. A divergence goes into `v1/<path>/mappers.ts` (frozen)
  versus `v2/<path>/mappers.ts`, so v1 keeps its old DTO shape over the new domain model.
- Support window: at most **two live versions**. v1 is retired only after `minSupportedVersion` (§4.5)
  has excluded every build that uses it, and logs show no v1 traffic for 30 days.

### 4.5 Deprecation, sunset and forced upgrade
- **Per endpoint:** `Route.deprecated: true` marks it in the spec [OBS: `contract.TuRtB1Ca.d.mts:96-101`].
  A `deprecation.ts` middleware reads procedure `meta` (`$meta({ sunset?: string })`, verified builder
  API) and sets `Deprecation` (RFC 9745) and `Sunset` (RFC 8594) headers through `context.resHeaders`
  from `ResponseHeadersPlugin` [OBS: plugins/index.d.mts:86-90], plus `Link: <…>; rel="deprecation"`.
  (RFC numbers and header formats are from memory, UNVERIFIED.)
- **Forced upgrade (must be in the first mobile release; it cannot be added later):**
  1. The mobile app sends `X-Client-Platform: ios|android` and `X-Client-Version: 1.4.0` (semver) on
     every request.
  2. Public `GET /api/v1/app-config` returns `{ minSupportedVersion, latestVersion, updateUrl }` per
     platform. The app checks it on launch and on foreground.
  3. Middleware `client-version.ts` rejects requests from builds below the minimum with a declared error
     `CLIENT_UPGRADE_REQUIRED` (HTTP 426), whose `data` contains `updateUrl`. The app shows a blocking
     "update" screen on that code from build 1.
  4. The minimum and latest values live in Vercel Flags or Edge Config (the app already uses Vercel
     Flags, `lib/flags.ts`), so they change without a deploy. Requests without the headers (web) skip the
     check.

### 4.6 Committed spec plus a CI breaking-change check
- `pnpm api:spec` generates `server/api/v1/openapi.snapshot.json` (sorted keys, stable output) with
  `OpenAPIGenerator` from the v1 contract, plus the raw-route patch.
- Unit test `server/api/v1/__tests__/openapi-snapshot.test.ts` regenerates the spec in memory and
  asserts it equals the committed file. This runs inside `pnpm check` with no network and no DB, which
  matches CLAUDE.md's requirement that `pnpm check` work in fresh worktrees. Effect: any contract change
  must commit the new spec, so the spec change is visible in review.
- CI job (GitHub Actions, `.github/workflows/`): `oasdiff breaking <main snapshot> <PR snapshot>` fails
  on error-level breaking changes. Use the Docker image `tufin/oasdiff` or `oasdiff/oasdiff-action`
  [OBS: github.com/oasdiff/oasdiff README]. The exact fail flag (`--fail-on ERR`) and the extent of
  OpenAPI 3.1 support are UNVERIFIED; the README points to a separate "OpenAPI 3.1 and 3.2 support" page.
  Override path: a `api-breaking-ok` PR label, allowed only for unreleased endpoints marked
  `x-unreleased`.
- *Alternatives:* Optic (heavier, with a SaaS angle) and Atlassian `openapi-diff` (npm; OpenAPI 3.1
  support UNVERIFIED). oasdiff wins on maturity and a documented "breaking" mode.
- Optional: `@hey-api/openapi-ts` or `openapi-typescript` contract tests that generate a client from the
  snapshot in CI. This proves the spec alone is consumable by non-oRPC clients, as the owner required.
  Tool choice UNVERIFIED.

### 4.7 Transition for the unversioned `/api/*` and server actions (skew)
- Web-only `/api/*` endpoints (history, vote, projects, prompts, subscription, usage, transactions, me,
  payment, topup, files/upload, chat) were never promised to mobile. They are **not versioned**; they are
  retired.
- Order per feature slice:
  1. Extract the logic into `server/modules`.
  2. Add the v1 endpoint.
  3. Switch the web client to v1.
  4. Keep the old route as a thin wrapper over the same module for **at least one release plus 14 days**.
  5. Log hits to the old route (a counter through the existing `/api/log` or the platform logs).
  6. Delete the old route once it has no traffic.
- Skew sources:
  - Open browser tabs running old JS keep calling the old `/api/*` paths and **old server-action IDs**.
    Server actions are already skew-fragile (their IDs change per build), so removing an action breaks
    stale tabs on submit. Keep the action exports as wrappers calling the module for the same window.
  - Vercel Skew Protection (pinning a client to its deployment) would remove most of this. Whether it is
    available or enabled on this project is UNVERIFIED; check the project settings.
- `/api/auth/[...nextauth]` stays for the web cookie session. The v1 auth middleware accepts either the
  cookie or a Bearer token. `getToken` already falls back to `Authorization: Bearer` when no cookie is
  present, and its default salt equals the cookie name [OBS:
  `node_modules/.pnpm/@auth+core@0.41.3/node_modules/@auth/core/jwt.js:86-104`]. Mobile token issuance
  (login/refresh) belongs to the auth researcher.
- **CSRF:** once cookie-authenticated JSON mutations exist outside server actions, which today carry
  Next's built-in origin check, configured at `next.config.ts` `experimental.serverActions.allowedOrigins`,
  v1 needs its own Origin/`Sec-Fetch-Site` check for cookie-auth requests. Bearer-auth requests are exempt.
  This is a new risk introduced by the migration.

### 4.8 Test coverage for this layer (summary)
- **Contract:** the spec snapshot test, the boundary test (§3.4), and the oasdiff CI job.
- **Procedure:** one `__tests__/procedure.test.ts` per endpoint using `call()`, with a fake context and
  mocked modules. Cover the happy path, auth missing (401), each declared error, and input validation.
- **HTTP:** a few `OpenAPIHandler.handle(new Request(...))` tests in `server/api/_kit/__tests__/` for
  error-body shape, 426 upgrade, Deprecation headers, query coercion, and 405/404 behaviour of the
  catch-all.
- **Domain:** existing `lib/billing/__tests__` etc. move with their modules; domain tests never touch oRPC.
- **E2E:** the existing Playwright suite (`tests/e2e/`) exercises the web on v1. Add a Playwright
  `request`-context API test that logs in with a Bearer token, without a browser, to simulate mobile.
