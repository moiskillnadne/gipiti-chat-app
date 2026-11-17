---
date: 2026-11-17
status: done
branch: docs/gipiti-231-spike-findings
issue: GIPITI-231
---

# Phase 2: oRPC dependencies and spikes before the server foundation

## Context

Phase 3 of the roadmap (`docs/plans/2026-11-15-orpc-v1-roadmap.md`) builds `server/api/_kit/*` and the first `/api/v1` endpoints on oRPC. Its design rests on claims the roadmap itself marks as unverified: how `OpenAPIHandler` encodes errors, whether `@orpc/zod/zod4` accepts `zod/v4` from the installed `zod@3.25.76`, how a catch-all route coexists with raw streaming routes, whether uploads fit through a Vercel function. Phase 2 answers those questions with throwaway code, so Phase 3 is planned on facts. Nothing from the spikes is merged; what reaches `main` is the dependency PR and a findings document.

Checked while planning:

- `@orpc/*@1.16.2` is the latest stable release (2026-11-06) and `jose@6.2.17` is the latest `jose`. `@orpc/zod@1.16.2` needs `zod >= 3.25.0`; the repo has 3.25.76.
- oRPC 2.0 is in active beta (`2.0.0-beta.50`, 2026-11-09, roughly weekly). The roadmap pins 1.x and tells us to read APIs from the installed type files, not from orpc.dev, which documents 2.0.
- `zod/v4` already runs in production: six AI tool files import it.
- The architecture test from Phase 0 already enforces every import boundary the roadmap wanted from Biome, so S8 is editor feedback only.
- **A design conflict:** the roadmap's `_kit/open-enum.ts` imports `JSON_SCHEMA_OUTPUT_REGISTRY` from `@orpc/zod/zod4`, but `tests/architecture/rules.ts` allows only `@orpc/contract` and `zod` in contract files. S1 has to settle this.
- **A suspected production defect:** chat uploads allow 10 MB and project files 25 MB through `request.formData()` in a Vercel function, while the platform's request body limit is believed to be about 4.5 MB. S4 measures it.

## Decisions for this phase

| # | Decision | Reason |
|---|---|---|
| P1 | Spikes first, the dependency PR (2a) after S1. | If `@orpc/zod/zod4` rejects `zod/v4` from 3.25, the Zod 4 upgrade returns to the critical path and 2a changes. Merging unused packages first would have to be redone. |
| P2 | One throwaway branch, `spike/gipiti-<id>-orpc-v1`, with a draft PR titled "DO NOT MERGE". Closed unmerged at the end. | The spikes share one minimal kit. A pushed branch gets a Vercel preview with its own Neon branch, which S3, S4, S5 and S7 need. |
| P3 | Findings go to `docs/plans/orpc-v1-roadmap/spike-findings.md`, merged by a docs PR. | The roadmap says "into the Phase 3 plan file", which does not exist yet. The Phase 3 plan will cite this file. |
| P4 | Everything the spike exposes on the preview sits under `/api/spike` and `/spike`, requires a signed-in session, and stores nothing. The upload probe counts bytes and discards them. | Previews share the production Blob token; a probe must not write there or leave an open endpoint. |
| P5 | Each API fact is recorded with its evidence: the type declaration (`node_modules/@orpc/*/dist/*.d.mts` path) or the captured request and response. | Decision D13: orpc.dev describes 2.0. |
| P6 | S8 is time-boxed to 30 minutes. If `patterns.group` is awkward, Biome boundary rules are dropped from the roadmap. | The architecture test already enforces the rules. |

## Order of work

One Linear issue in team `GIPITI`. Work happens on the spike branch in this order; each spike ends with a section in the findings file (question, method, result, evidence, decision for Phase 3, roadmap lines to change).

### Cheap confirmations first

- **S9, `client/pages` is not a router.** Stub `client/pages/x.tsx` and `client/app/y.tsx`; `pnpm exec next build`; the route list has no `/x` or `/y`. Fallback if wrong: layers named `_app` and `_pages`.
- **S8, Biome `noRestrictedImports` in `overrides`.** One override with `patterns.group` in `biome.jsonc` and one violating file. Record: `*` against `**`, whether relative specifiers match, whether override options merge or replace. Time-boxed (P6).

### The kit (everything else builds on it)

- **S1, errors, generator, zod, `openEnum`.** Under `server/api/_spike/`: a contract with two procedures (a public one whose output has an open enum, a protected one that throws `UNAUTHORIZED`), `implement(contract)`, an `OpenAPIHandler` at `app/api/spike/[[...rest]]/route.ts`, and `OpenAPIGenerator` with `ZodToJsonSchemaConverter` from `@orpc/zod/zod4`. Record:
  - the status, headers and body of a 401, of a validation failure and of an unknown path;
  - which OpenAPI version the generator emits and whether it can be pinned; `customErrorResponseBodySchema`; the bearer security scheme; whether extra `paths` merge or replace;
  - whether `zod/v4` schemas from 3.25.76 convert at runtime;
  - query coercion (`z.coerce.number()`, `z.stringbool()`) through the handler;
  - `openEnum`: that the field is emitted as `type: string`, and which of three placements works with the architecture rule: allow `@orpc/zod` in contract files (it then ships to the browser, see S2), register the entry outside the contract zone (in the generator factory), or express it with zod's own `.meta()`.
- **S6, version override.** A types-only sample: a v2 contract and router that spread v1, override one key and omit another. `pnpm typecheck` passes.

### Routing and the web client

- **S3, route precedence.** Next to the catch-all: `app/api/spike/chats/[chatId]/turns/route.ts` (raw `POST`) and `.../stream/route.ts` (raw `GET`), each with its own `maxDuration`. With `next build && next start`, and again on the preview, record a matrix: `POST turns`, `GET turns`, `POST turns/{id}/stop` (must reach the catch-all), `GET stream`, `POST stream`, an unknown path (404 JSON). Fallback already named by the roadmap: stop at `POST /chats/{chatId}/stop`.
- **S2, `OpenAPILink` and its bundle cost.** A client component on `app/spike/page.tsx` calls the sample procedure through `createORPCClient(new OpenAPILink(contract, …))`. Record the constructor as declared in 1.16.2, whether the link validates responses by default, and the client JavaScript of the page built without and with the contract and link (the roadmap named no baseline; this is it), plus the extra cost if contract files import `@orpc/zod`.
- **S5, the principal and web login.**
  - `auth()` inside an oRPC procedure (cookie caller) and inside a server component through `createRouterClient(router, { context })`; what `request` the in-process call has to synthesize.
  - `signIn("credentials", { redirect: false })` from `next-auth/react` on a spike login form: the result for a correct password, a wrong one, a refused attempt (`code: "rate_limited"`) and a non-auth failure. The refused case is run on the preview, where the Phase 1 login limits are enforced: 11 wrong passwords in a row. That is also the live check of those limits that Phase 1 left open.

### Platform questions

- **S7, flags for a bearer caller.** The code already answers most of it: `getToken` returns `null` when decoding fails, and `flags@4.2.0` accepts explicit entities (`flag.run({ identify })`). Confirm with a unit test that `getToken` returns `null` for an HS256 token made by `jose`, and on the preview that `isTopupEnabled.run({ identify: { user: { id } } })` evaluates for an explicit user inside a procedure.
- **S4, uploads.**
  - The platform limit: an authenticated probe at `/api/spike/upload` that reads the body and answers with the byte count. From a script, send 3, 5, 6, 10 and 25 MB to the preview and record each status. Cross-check with the production logs of `/api/files/upload` and `/api/projects/[id]/files` (Vercel MCP `get_runtime_logs`) for 413 answers.
  - oRPC `File` input: a procedure with a file field through `OpenAPIHandler`, locally.
  - Decide between oRPC multipart, a raw multipart route, and direct-to-Blob upload. If the limit is near 4.5 MB, direct-to-Blob moves from "later" (decision D19) into v1, and the current 10 MB and 25 MB limits are a production defect to report with its own issue.
- **oRPC 2.0, reading only.** From the 2.0 beta release notes, list what would change in the kit this phase sketched. Recommendation to record: stay on 1.16.2, re-check before Phase 5.

### What reaches `main`

- **PR 2a, dependencies.** `pnpm add -E @orpc/contract@1.16.2 @orpc/server@1.16.2 @orpc/client@1.16.2 @orpc/openapi@1.16.2 @orpc/openapi-client@1.16.2 @orpc/zod@1.16.2 jose@6.2.17`, changed by whatever S1 found. Only `package.json` and `pnpm-lock.yaml`.
- **Docs PR.** `spike-findings.md`; roadmap edits that follow from the findings (decisions D6, D11, D12, D19, the `openEnum` row, the Phase 3 file list); the stale evidence rows found while planning (the removed `update` override, the limiter row, 36 route files, the attachment policy file name and caps, 21 files importing `zod`, the dropped `migrate.ts` guard still cited in the risk table, S4's missing 25 MB case); this plan with `status: done`.
- The draft spike PR is closed unmerged. The branch stays until Phase 3b lands, as a reference.

## Files that change

| Where | Files |
|---|---|
| Spike branch only, never merged | `server/api/_spike/*`, `app/api/spike/**`, `app/spike/**`, `client/pages/x.tsx`, `client/app/y.tsx`, a sample `biome.jsonc` override, `package.json`, `pnpm-lock.yaml`, one scratch script for the upload probe |
| PR 2a | `package.json`, `pnpm-lock.yaml` |
| Docs PR | `docs/plans/orpc-v1-roadmap/spike-findings.md` (new), `docs/plans/2026-11-15-orpc-v1-roadmap.md`, this plan |

No file under `app/`, `lib/` or `tests/` changes on `main` in this phase.

## Risks

| Risk | Mitigation |
|---|---|
| A spike endpoint on the preview is reachable by anyone | P4: session required, nothing stored; the draft PR is closed at the end. |
| The upload probe costs bandwidth or hits function limits | Five requests, bodies generated by the script, discarded by the handler. |
| A spike "passes" locally and behaves differently on Vercel | S3, S4, S5 and S7 are repeated on the preview; the findings say which environment each result comes from. |
| Findings come from documentation of the wrong major version | P5. |
| The architecture test fails on the spike branch | Expected and harmless there; where it fails is itself a finding for Phase 3. |
| oRPC 2.0 goes stable during the migration | Exact pins; the 2.0 reading above; re-check before Phase 5. |

## Verification

- Every spike S1 to S9 has a section in `spike-findings.md` with its result, the evidence and a decision; nothing is left as "unverified" without saying why.
- On the spike branch: `pnpm typecheck` passes; `pnpm exec next build` passes; the preview deployment is READY (Vercel MCP `list_deployments`); the S3 matrix and the S4 statuses are captured from the preview.
- PR 2a: `pnpm check` passes; CI green; the preview build is READY.
- Docs PR: the roadmap no longer contradicts the findings; `pnpm check` passes.
- Rollback: revert PR 2a. The spike branch has nothing to roll back.

## Implementation notes (2026-11-17)

Done: spikes S1 to S9, the oRPC 2.0 notes, PR #291 (dependencies), the findings in `docs/plans/orpc-v1-roadmap/spike-findings.md`, the draft spike PR #290, and GIPITI-232 for the upload defect S4 found.

Where the work departed from this plan:

- **The preview is behind Vercel Authentication.** The owner signed in to Vercel in the browser; the preview checks were then run from that browser with `fetch`, not from a script. No share link was created.
- **Nobody was signed in to the app on the preview**, so the catch-all's rows of the S3 matrix show the spike's own 401 gate, the S4 probe shows the route's 401 for bodies that reached the function, and S7 was run only on a local production build.
- **P4 turned out to be mostly moot**, because the preview is not public. Two things in the spike are not behind a session anyway: the raw stub routes (fixed text) and `/spike/login` (a bare sign-in form).
- **S4 stopped at 4.7 MB.** The boundary was found between 4 403 200 and 4 505 600 bytes; the 5 to 25 MB bodies were not waited for.
- **The production cross-check for S4 was dropped.** Runtime logs do not show requests the platform refuses before a function runs. Unauthenticated probes of the production upload route were answered by Vercel's Security Checkpoint, which became a finding of its own; production was not probed further.
