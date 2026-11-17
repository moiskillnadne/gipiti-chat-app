# Spike findings for the oRPC v1 migration (Phase 2)

Date: 2026-11-17. Linear: GIPITI-231. Plan: `docs/plans/2026-11-17-phase-2-orpc-dependencies-and-spikes-before-the-se.md`.

These are the answers to spikes S1-S9 of the roadmap (`docs/plans/2026-11-15-orpc-v1-roadmap.md`, Phase 2). The probe code is on the branch `spike/gipiti-231-orpc-v1` (draft PR #290, never merged); file names below without a path prefix are on that branch.

Versions the answers hold for: `@orpc/{contract,server,client,openapi,openapi-client,zod}` 1.16.2, `jose` 6.2.17, `zod` 3.25.76 (imported as `zod/v4`), `next` 16.4.6, `next-auth` 5.0.0-beta.32, `flags` 4.2.0, `@biomejs/biome` 2.2.2, Node 22.

Every API fact was read from the installed type declarations (`node_modules/@orpc/*/dist/**/*.d.mts`) or from a captured response, not from orpc.dev, which documents 2.0.

"Local" means `next build` followed by `next start` on a developer machine. "Preview" means the Vercel preview deployment of the spike branch.

## Summary

| Spike | Answer | What Phase 3 does with it |
|---|---|---|
| S1 errors | The handler answers with the error's HTTP status and the body `{ defined, code, status, message, data? }`. Unexpected errors become a sanitised 500. | Decision D11 stands. The kit writes its own 404 for unmatched paths. |
| S1 generator | Emits OpenAPI 3.1.1; the version cannot be chosen. Hand-written `paths` are merged with the generated ones. | S11 must run `oasdiff` against 3.1. Raw routes can be documented through `paths`. |
| S1 zod | `@orpc/zod/zod4` converts `zod/v4` schemas from `zod@3.25.76`. | Decision D12 stands; no Zod 4 upgrade is needed. |
| S1 `openEnum` | `z.string().meta({ description })` is emitted as `type: string` and needs no oRPC import. | `_kit/open-enum.ts` uses zod's `.meta()`. The architecture rule stays as it is. |
| S2 | `new OpenAPILink(contract, { url })`; no response validation unless a plugin is added. Cost: 27 KB of client JavaScript (9.5 KB gzip) for oRPC, plus 70 KB (18 KB gzip) for `zod/v4` on pages that do not ship it yet. `/chat` already ships it. | Decision D7 stands. |
| S3 (local only) | A deeper path (`/turns/{id}/stop`) reaches the catch-all. A raw route file owns every method on its exact path and answers the others with an empty 405. | No fallback stop path. Raw route files export a handler for the other methods so they answer in the error envelope. |
| S4 | oRPC accepts a multipart `File` input. **The platform's body limit was not measured** (the preview is behind Vercel Authentication). | The upload design waits for that measurement. |
| S5 | `auth()` gives the cookie principal inside an oRPC procedure and inside a server component through `createRouterClient`. `signIn` from `next-auth/react` reports failure in `error` and `code` while `ok` stays `true`. | Decisions D10 and D14 stand. The login form checks `error`, never `ok`. |
| S6 | A v2 contract and router that spread v1, override a key, add one and drop one typecheck. | Versioning rule 6 stands. |
| S7 | `getToken` returns `null` for a bearer JWS. `flag.run({ identify })` evaluates for an explicit user inside a procedure. | `server/flags.ts` passes the principal through `run`. |
| S8 | Works in `overrides`, with four limits (below). | Optional editor feedback only; the architecture test stays the gate. |
| S9 | `client/pages` and `client/app` produce no routes. | Decision D2 stands; no rename. |

## S1. Error encoding, the generator, zod and `openEnum`

**Method.** `server/api/_spike/contract.ts` (contract-first, `oc` from `@orpc/contract`), `router.ts` (`implement(contract).$context<…>()`), `openapi.ts` (`OpenAPIGenerator` with `ZodToJsonSchemaConverter` from `@orpc/zod/zod4`), `app/api/spike/[[...rest]]/route.ts` (`OpenAPIHandler` from `@orpc/openapi/fetch`, `handler.handle(request, { prefix, context })`). Requests with `curl` against the local build.

### Error bodies (local)

| Case | Status | Body |
|---|---|---|
| Typed error from a procedure (`errors.UNAUTHORIZED()`) | 401 | `{"defined":true,"code":"UNAUTHORIZED","status":401,"message":"Sign in to continue."}` |
| Typed error with data | 402 | `{"defined":true,"code":"INSUFFICIENT_BALANCE","status":402,"message":"Top up to continue.","data":{"reason":"balance_empty"}}` |
| Input fails validation (`?limit=abc`) | 400 | `{"defined":false,"code":"BAD_REQUEST","status":400,"message":"Input validation failed","data":{"issues":[{"expected":"number","code":"invalid_type","received":"NaN","path":["limit"],"message":"Invalid input"}]}}` |
| Malformed JSON body | 400 | `{"defined":false,"code":"BAD_REQUEST","status":400,"message":"Malformed request. Ensure the request body is properly formatted and the 'Content-Type' header is set correctly."}` |
| A handler throws a plain `Error` | 500 | `{"defined":false,"code":"INTERNAL_SERVER_ERROR","status":500,"message":"Internal server error"}` (the thrown message, which held a connection string, did not leak) |
| No procedure matches the path, or the method is wrong for a procedure path | none | `handle()` resolves `{ matched: false }`; the route file has to answer |

All have `content-type: application/json`. `defined` is `true` only for errors declared in the contract's error map.

**For Phase 3:**

- The envelope of decision D11 is what the library sends; nothing has to be re-encoded.
- The kit must write the 404 itself for `matched: false`, in the same shape. A wrong method on a known path also arrives there, so it is a 404, not a 405.
- A validation failure exposes zod's `issues` under `data`. They contain field paths and limits from the contract, which are public in the spec anyway.

### The generated document (local)

- `openapi` is `3.1.1`. `generate()` takes `Partial<Omit<OpenAPI.Document, "openapi">>` (`openapi/dist/shared/openapi.BGy4N6eR.d.mts`), so the version cannot be set.
- `info`, `servers`, `components.securitySchemes` and `security` pass through unchanged.
- A hand-written entry under `paths` is kept next to the generated ones (merged, not replaced). The raw streaming routes can be documented this way.
- Error responses are generated per status as `oneOf` of the declared error (with `code` and `status` as `const`) and an undeclared one (`code: string`). The roadmap wants `code` to be an open string everywhere; `customErrorResponseBodySchema` (same declaration file) is the hook for that.
- Path parameters and query parameters are generated from the input object. A `z.coerce.number().int().min(1).max(100).default(20)` query field becomes `{"type":"integer","minimum":1,"maximum":100,"default":20}`.
- A `z.stringbool()` query field becomes `{"type":"string"}`: the spec does not say it is a boolean. A `.meta({ description })` on the field is needed for readers.
- A `z.file()` field is offered under both `application/json` and `multipart/form-data` as `{"type":"string","contentMediaType":"*/*"}`.

### Query coercion (local)

`GET /echo?limit=7&archived=true&cursor=x` → `{"limit":7,"archived":true,"cursor":"x","limitType":"number"}`. Without a query the default applies (`limit: 20`). No plugin was needed. On a typed client the input type of a `z.stringbool()` field is `string`, so callers pass `"true"`, not `true`.

### zod

`zod/v4` from `zod@3.25.76` has `.meta()`, `z.file()`, `z.stringbool()` and `z.coerce`, and its schemas convert at runtime. `@orpc/zod@1.16.2` declares `zod >= 3.25.0` as its peer. The Zod 4 upgrade (roadmap Phase 13b) stays optional.

### `openEnum`

Both variants were tried on one output object; a closed `z.enum` next to them for comparison:

| Declared as | Emitted schema |
|---|---|
| `z.string().meta({ description, examples })` | `{"type":"string","description":"Known values: free, paid. Other values may appear.","examples":["free"]}` |
| `z.string()` plus an entry in `JSON_SCHEMA_OUTPUT_REGISTRY`, added in the generator module | `{"type":"string","description":"Open set; unknown values may appear.","x-known-values":["stable","beta"]}` |
| `z.enum(["a","b"])` | `{"enum":["a","b"],"type":"string"}` |

At runtime both open variants let a value outside the known list through (`"enterprise"`, `"nightly"`), on the server and on the browser client.

The converter reads zod's global registry but takes only `title`, `description` and `examples` from it (`zod/dist/zod4/index.mjs`, `#getCustomJsonSchema`). So `.meta()` can describe the known values but cannot add an `x-` extension.

**Decision.** `_kit/open-enum.ts` is `z.string().meta({ description })` with the TypeScript type `Known | (string & {})`. It imports only `zod`, so the contract-zone rule of `tests/architecture/rules.ts` (only `@orpc/contract` and `zod`) stays as it is, and `@orpc/zod` does not reach the browser bundle. If a generated mobile client later needs the values as data (spike S14), the registry variant can be added in `_kit/openapi.ts` without touching a contract file.

## S2. `OpenAPILink` and its cost in the browser

**Method.** `app/spike/spike-client.tsx`, a client component; `app/spike-baseline`, the same page with a plain `fetch`. Client chunks per page were read from `.next/server/app/<page>/page_client-reference-manifest.js` after a local Turbopack build.

- Constructor: `new OpenAPILink(contract, { url, headers?, fetch?, customErrorResponseBodyDecoder? })` (`openapi-client/dist/adapters/fetch/index.d.mts`), wrapped with `createORPCClient<ContractRouterClient<typeof contract>>(link)`.
- The contract object is needed at runtime, so its zod schemas ship to the browser.
- No response validation by default: the client returned open-enum values the schema's known list does not contain. Validation exists only as `ResponseValidationPlugin` in `@orpc/contract/plugins`, which the architecture test already bans.
- A typed error arrives on the client as an error with `defined`, `code`, `status`, `data` (`code: "INSUFFICIENT_BALANCE"`, `data.reason` intact).

| | Raw | Gzip |
|---|---|---|
| Baseline page, all client chunks | 114.9 KB | 38.2 KB |
| Page with the contract and the link | 211.2 KB | 65.5 KB |
| Added: oRPC client chunk | 27.0 KB | 9.5 KB |
| Added: `zod/v4` chunk | 69.7 KB | 18.1 KB |

The `zod/v4` chunk is the same file the `/chat` page already loads (`/chat` ships both `zod/v4` and the v3 build today; 1866 KB raw, 552 KB gzip in total). On `/chat` the cost of the client is therefore the oRPC chunk alone, about 1.7% of its gzip size. Pages that ship no zod today (`/login`, `/subscription`) would pay for both chunks once they import the client. The spike contract has nine small procedures; the real contract's own schemas come on top and are not measured here.

## S3. Route precedence next to the catch-all

**Method.** `app/api/spike/[[...rest]]/route.ts` (catch-all, `maxDuration = 60`), `chats/[chatId]/turns/route.ts` (exports `POST` only, `maxDuration = 800`), `chats/[chatId]/stream/route.ts` (exports `GET` only, `maxDuration = 800`). Requests with `curl`.

| Request | Local | Answered by |
|---|---|---|
| `POST /chats/c1/turns` | 200 | raw route |
| `GET /chats/c1/turns` | 405, empty body | raw route file (no `GET` export) |
| `DELETE /chats/c1/turns` | 405, empty body | raw route file |
| `POST /chats/c1/turns/t1/stop` | 200, the procedure's JSON | catch-all |
| `GET /chats/c1/stream` | 200 | raw route |
| `POST /chats/c1/stream` | 405, empty body | raw route file |
| `HEAD /chats/c1/stream` | 200 | raw route (`GET`) |
| `OPTIONS /chats/c1/turns` | 204, `allow: OPTIONS, POST` | Next |
| `GET /chats/c1` | 404 from our handler | catch-all (`matched: false`) |
| `GET /nope/deeper`, `GET /api/spike` | 404 from our handler | catch-all |

**Not repeated on Vercel.** The preview of the spike branch is behind Vercel Authentication, and the session that ran the spikes had no way in without creating a public share link, which was left to the owner. Next's own routing produced the table above; whether Vercel's router agrees is open until the matrix is run on the preview (see "Open items").

**For Phase 3 and 6:**

- Stop stays an oRPC procedure at `POST /chats/{chatId}/turns/{turnId}/stop`; the fallback path is not needed.
- A raw route file takes every method on its exact path. To answer the other methods in the error envelope instead of an empty 405, each raw route file exports them too, from one shared helper in `_kit/raw-route.ts`.
- No procedure may use the exact path of a raw route (`/chats/{chatId}/turns`, `/chats/{chatId}/stream`) with another method: it would never be reached.

## S4. Uploads

**The platform's request body limit was not measured.** This is the main open item of the phase.

- The plan was to send 3 to 25 MB bodies to a probe on the preview. The preview is behind Vercel Authentication (see S3).
- A fallback, sending unauthenticated bodies to the production upload route (they end in 401 before anything is stored), did not work either: production answers non-browser requests on that path with Vercel's Security Checkpoint (see "A finding outside the spikes"), and the same probe from a browser was refused by the tooling as out of bounds. Production was not probed further.
- Vercel's function limits documentation, as the author of this note remembers it, gives 4.5 MB for a request body, answered with 413 `FUNCTION_PAYLOAD_TOO_LARGE`. That page was not retrieved in this session, so treat the number as unconfirmed.

What is certain from the code: `POST /api/files/upload` accepts files up to 10 MB and `POST /api/projects/[id]/files` up to 25 MB, both by reading `request.formData()` inside a function. If the 4.5 MB limit applies, uploads between 4.5 MB and those caps fail today with a platform error instead of the route's own message.

**For Phase 3 and 5:** do not design `POST /api/v1/uploads` as multipart-through-a-function until the limit is measured. If it is near 4.5 MB, direct-to-Blob upload (`@vercel/blob` client uploads) moves from "later" (decision D19) into v1, and the current limits become a production defect with its own issue.

**oRPC `File` input (local).** A procedure with `z.object({ file: z.file(), note: z.string().optional() })` received a 1 MB multipart upload through `OpenAPIHandler`: `{"name":"one-megabyte.bin","size":1048576,"type":"application/octet-stream"}`. A request without the file field, or with a JSON body, is a 400 with a zod issue `expected: "file"`. So multipart through oRPC works, and a raw multipart route is not needed for parsing.

## S5. The principal and web login

**Method.** `router.ts` (`me` calls `auth()` from `app/(auth)/auth`), `app/spike/page.tsx` (a server component calling the same procedure through `createRouterClient`), `app/spike/login/page.tsx` (`signIn` from `next-auth/react`). Driven in a browser against the local build with the local test user.

- **Cookie caller over HTTP.** Signed out: 401 `UNAUTHORIZED` (above). Signed in: `{"userId":"<id>","via":"http"}`.
- **Server component, in-process.** `createRouterClient(router, { context: { request, transport: "in-process" } })`. Signed out, the call rejects with an error that has `code: "UNAUTHORIZED"` and `status: 401`. Signed in: `{"userId":"<id>","via":"in-process"}`.
- `auth()` reads the cookies from Next's own request scope in both cases. The `request` in the context is not what `auth()` uses; for the in-process call a synthesized `new Request("http://in-process.invalid/", { headers: await headers() })` only satisfies the context type. `resolvePrincipal` will still read `Authorization` from `context.request` for bearer callers.
- **`signIn("credentials", { email, password, redirect: false })` from `next-auth/react`:**

| Case | Resolved value |
|---|---|
| Wrong password | `{"error":"CredentialsSignin","code":"credentials","status":200,"ok":true,"url":null}` |
| Unknown email | the same |
| Correct password | `{"status":200,"ok":true,"url":"http://localhost:3005/spike/login"}` |
| Refused by the login limiter | not run: the limits apply only on deployments, and the preview could not be reached (see "Open items"). Expected from the code: `error: "CredentialsSignin"`, `code: "rate_limited"` |

`ok` is `true` and `status` is 200 for a failed sign-in. The login form must test `error` (and read `code`), never `ok`.

## S6. A second version by spreading the first

`server/api/_spike/v2.ts`: the v2 contract spreads v1, overrides `config` with a different output, adds `chats.list` next to the inherited `chats.turns.stop`, and drops `boom` by destructuring it out. The v2 router does the same with `implement(v2Contract).router({ ...v1RouterWithoutBoom, config: …, chats: { ...v1Router.chats, list: … } })`. `pnpm typecheck` passes. Procedures implemented for v1 are accepted by the v2 implementer unchanged.

## S7. Flags for a bearer caller

- `getToken` from `next-auth/jwt`, given `Authorization: Bearer <HS256 token signed with jose>` and no cookie, returns `null` and does not throw (`server/api/_spike/__tests__/get-token-with-jws.test.ts`; in `@auth/core` the decode is wrapped in `try … catch { return null }`).
- `isTopupEnabled.run({ identify: { user: { id } } })` (`flags/dist/next.d.ts`, the `run` method) evaluates inside an oRPC procedure. Locally it returned `true` for the explicit user, the same as the cookie evaluation for that user.
- Not run on the preview: it needs a signed-in session there, which needs an account in the preview database. The local run uses the same production build.

**For Phase 4:** `identify` in `server/flags.ts` stays cookie-based for pages; API code calls `flag.run({ identify: { user: { id: principal.userId } } })`. When a request carries both a cookie and a bearer token, `getToken` prefers the cookie while `resolvePrincipal` prefers the bearer, so API code must always pass the principal explicitly.

## S8. Biome `noRestrictedImports` in `overrides`

A sample override on `client/**` with `options.patterns: [{ group: ["@/server/**", "@/app/*"], message }]`:

| Import in `client/pages/…` | Reported |
|---|---|
| `@/server/api/_spike/contract`, `@/server/flags` | yes |
| `../../server/api/_spike/contract` (relative) | **no**: patterns match the specifier text |
| `@/app/layout` | yes |
| `@/app/(auth)/auth` | **no**: `*` is one path segment; `**` is needed |
| `import type … from "@/server/…"` | yes: type-only imports are reported too |
| the same import in a file outside `client/**` | no |

A second override matching the same file **replaces** the options of the first; it does not add to them.

**Decision.** The rule can give editor feedback for alias imports, with `**` globs and one override per zone that lists every forbidden group. It cannot allow type-only imports and cannot see relative paths, so it is not a gate. `tests/architecture/` stays the source of truth (it resolves relative imports and distinguishes type-only ones). Adding the Biome overrides is optional and belongs to Phase 11, if at all.

## S9. `client/pages` and `client/app`

Stubs `client/pages/x.tsx` (default-exported component) and `client/app/y/page.tsx` were added and the app was built. The route list (68 routes) has no `/x` and no `/y`; `.next/server/pages` holds only `404.html` and `500.html`. The FSD layer names can stay `app` and `pages` under `client/`.

## oRPC 2.0

Read from the release notes of `middleapi/orpc` on 2026-11-17; nothing was run.

- 1.16.2 (2026-11-06) is the latest 1.x. 2.0 is at `beta.50` (2026-11-09), with a release roughly every week and breaking changes in most of them.
- `beta.49` says it "cleans up option shapes before v2 stable", so a stable 2.0 looks close.
- Changes that touch what this phase sketched: the custom error-body hooks are renamed (`errorResponseBodyEncoder`, `errorResponseBodyDecoder`, `errorResponseBodySchema`) and no longer fall back to the default when they return nothing (`beta.48`); OpenAPI component names are sanitised (`beta.49`); a new OpenAPI router (`beta.48`).

**Recommendation.** Stay on the exact 1.16.2 pins for Phases 3 to 6. Keep every oRPC import inside `server/api/_kit/*`, contract files and `client/shared/api/*`, so an upgrade touches a known set of files. Look again before Phase 5.

## A finding outside the spikes: Vercel's Security Checkpoint

On 2026-11-17 plain `curl` requests to production were answered like this:

| Request | Answer |
|---|---|
| `GET https://gipiti.ru/api/health` | 200 |
| `GET /api/cron/cleanup-payment-intents` (no secret) | 401 from the route |
| `GET /login` | 429, `x-vercel-mitigated: challenge`, page title "Vercel Security Checkpoint" |
| `GET` and `POST /api/files/upload` | 429, the same challenge |

So the Vercel Firewall challenges requests that do not come from a browser on at least some paths. A browser passes the challenge without the user noticing; a native mobile client cannot run it. **If the same rule covers `/api/v1/*`, the mobile app's requests will be answered with a 429 challenge page instead of JSON.** The firewall configuration could not be read with the tools at hand (the Vercel connection has no firewall access), so which rule does this, and since when, is not known.

**For the owner, before Phase 3b ships an endpoint:** look at the project's Firewall settings (Bot Protection, Attack Challenge Mode, custom rules) and decide how `/api/v1/*` is exempted or handled for the mobile client.

## Open items

These need access to the protected preview (the owner signing in to Vercel in the browser, or a share link) and then take minutes:

1. S3: the route matrix on Vercel.
2. S4: the request body limit (3, 5, 6, 10 and 25 MB to `/api/spike/upload`).
3. S5: the `signIn` result for an attempt the login limiter refuses (11 wrong passwords). This is also the live check of the Phase 1 login limits.
4. S7: `flag.run({ identify })` on a deployment.

## Corrections to the roadmap that follow

- Decision D12: 21 files import `zod` today, not 26; six more already import `zod/v4`.
- The `openEnum` row and the `_kit/open-enum.ts` line: zod `.meta()`, not `JSON_SCHEMA_OUTPUT_REGISTRY`.
- S3: no fallback stop path; raw route files export the other methods.
- S5: the web login checks `error`, not `ok`.
- S8: Biome boundary overrides are optional feedback.
