# Critique: risk, security, money, compatibility

Target: `draft-plan.md`. Lens: auth, money safety, versioning and backward compatibility, deploy skew, Next/Vercel constraints, migrations and rollback, tests on the riskiest paths.
Markers: [OBS] = observed in the repo or in installed packages (path:line). [INF] = inference. UNVERIFIED = not checked.

## Verdict

The plan is well researched, and its main structural choices hold up for a money app: bearer tokens alongside the NextAuth cookie, `/api/v1` with an excluded proxy matcher, raw SSE routes for the chat turn, and a test net before the moves. The weak points are not in the routing; they are at the edges the plan treats as solved:
- The raw turn route, which spends money, sits outside the `_kit` middleware chain (CSRF, 426, error envelope).
- Revocation on the cookie path only works where `resolvePrincipal` is used.
- The refresh grace window cannot be built with hash-only token storage.
- A retried chat turn is a paid regeneration.
- The new public register API makes the existing grant farming easier to script. All rate limits disappear if Upstash REST is not configured.
- A server-side fetch of any URL in `file` parts is carried into v1 unchanged.
- "Open enums" are declared but are neither expressible in the spec nor enforced on the client.
- The AI SDK stream and message-part shapes, which old mobile builds will depend on most, are outside the versioning machinery.
- Two parts of the Phase 0 safety net do not work as written: byte-identical characterization files and legacy-action hit counts.

None of this sinks the plan, but about 12 findings need a design change before Phases 5, 6 and 8.

## Findings

### Major

**M1. Raw SSE routes bypass the whole `_kit` middleware chain (CSRF, 426, envelope, rate limit).** Sections: D6/D8, `_kit/middleware/*`, Security considerations.
- Problem: `csrf.ts`, `client-version.ts`, `rate-limit.ts`, `activity.ts` and the error interceptor are oRPC middleware. `POST /api/v1/chats/{chatId}/turns` and `GET …/stream` are raw route handlers (D8), and so possibly are the multipart uploads (D19/S4). The endpoint that spends money therefore gets no CSRF check, no forced-upgrade check and no unified error body, while the plan's security table says cookie-authenticated mutations are covered.
- Also: the CSRF rule "JSON-only bodies (`Content-Type` check)" contradicts multipart uploads.
- Evidence [OBS]: today's chat POST parses with `request.json()` whatever the content type (`app/(chat)/api/chat/_lib/parse-request.ts:19`), so a cross-site `text/plain` simple request is parsed. Only SameSite=Lax stops it.
- Evidence [OBS]: ownership failure is `forbidden:chat` 403 (`prepare-chat-turn.ts:232-233`, `stream/route.ts:51-52`, `stop/route.ts:42-43`), against the v1 rule "ownership → 404".
- Fix: build the `_kit` checks as plain functions (`(request, principal) => Response | null`). Call them from both the oRPC middleware and a `withV1Raw(handler)` wrapper used by every raw route. Allow `multipart/form-data` only on the upload routes. Add HTTP tests that assert CSRF, 426 and the 404-for-foreign-chat on the turn, stream and upload routes.

**M2. Revocation on the cookie path is partial: `ver` is checked only inside `resolvePrincipal`.** Sections: Token model ("Resolution order", "NextAuth changes"), `logout-all`, `password/reset`.
- Problem: the plan bumps `token_version` on reset and `logout-all` and says this "kills web cookies too". The check exists only in `resolvePrincipal`. The other `auth()` callers keep serving a revoked cookie until Phase 12: about 31 legacy route handlers, the page guards and `proxy.ts` (`getToken`).
- Concrete case: a password reset done because of account theft leaves the attacker's web session working on every legacy `/api/*` route for months.
- Evidence [OBS]: the `jwt` callback runs on every `auth()` and already reads the DB on `update` (`app/(auth)/auth.ts:80-131`). The research counts 42 `auth()` sites.
- Fix: check `ver` in the NextAuth `jwt` callback itself (return `null` on mismatch). That covers every `auth()` site at once. Cache `token_version` per user in Redis for a few seconds if the DB read per request matters.
- Also: treat a missing `ver` claim in existing cookies as `0`, or every current user is logged out. Write the cookie test to assert this.

**M3. The refresh "grace window returns the already-issued successor pair" cannot be built with hash-only storage.** Section: Token model, "Reuse detection".
- Problem: refresh tokens are stored only as SHA-256 (plan; `research-auth.md:150`). Returning the same successor pair on a retry needs the plaintext successor refresh token, which the server no longer has. An implementer will either store successors in plaintext, which defeats the hashing, or mint a third token, which the research explicitly rejects.
- This path is common: a mobile app fires several requests, all get 401, and all refresh at once.
- Fix, pick one and write it into the plan:
  - (a) Store the successor encrypted with an `API_TOKEN_SECRET`-derived AEAD key, for the grace period only, and wipe it once it is used or after 30 s.
  - (b) Within the grace window, mint a sibling pair in the same family and revoke the first successor only if both are later used.
  - (c) Make the client serialize refreshes (single-flight) and drop the grace window.
- Add an integration test for N parallel refreshes with the same token.

**M4. Chat-turn retries are paid regenerations; there is no idempotency for mobile retries.** Sections: API design (`POST /chats/{chatId}/turns`), Phase 8, money safety.
- Problem: a second POST with the same `message.id` is treated as a regenerate. The user-message insert becomes a no-op and inference runs and is charged again.
- Evidence [OBS]: `prepare-chat-turn.ts:262-289` ("Regenerate re-sends a stored user message (the insert above is then a no-op)").
- The turn slot only blocks while a turn is in flight (`route.ts:86-101`). A retry after a dropped connection on a finished or still-streaming turn either re-bills or returns 429.
- For mobile, the correct reaction to a lost connection is resume (`GET …/stream`), not re-POST. The plan never says so, and the OpenAPI spec cannot carry it.
- Fix: add an explicit `trigger: "submit" | "regenerate"` (the AI SDK already sends `trigger`; verify it in `HttpChatTransport`).
  - For `submit`, if the message id already has an assistant reply or an active stream, return `409 TURN_ALREADY_EXISTS` with `data.streamId`.
  - Document "network loss → resume, never re-POST" in the mobile README.
- Test it in Phase 8 together with a client-abort test that asserts the turn is still charged (mobile apps get backgrounded mid-stream).

**M5. Grant farming through the public register API, and limits that may not exist at all.** Sections: Auth endpoints (`register`, `email-verification/send`), Security considerations, Phase 1g, Q7.
- Problem: v1 publishes, in a spec, a register endpoint that returns tokens immediately. Every new account gets 50 RUB, credited before email confirmation (`lib/billing/constants.ts:10-18`); confirming a real inbox adds 100 and the quiz another 50. The only proposed defence is a per-IP limit, which is weak against IPv6 and mobile CGNAT and blocks legitimate users behind shared NAT.
- `email-verification/send` lets a script send codes from GIPITI's domain to any address, which hurts Resend reputation.
- Also [OBS]: every limiter is a no-op when `getUpstashClient()` returns null (`lib/rate-limit.ts:15,63-71`). That happens whenever Redis is configured as TCP `REDIS_URL` rather than Upstash REST (`lib/redis.ts:15-35`). Q7's "fail closed when configured but erroring" does not cover "not configured". The new login and register limits could silently not exist in production.
- Fix:
  - Fail closed at startup or in `/api/health` in production when the limiter client is missing.
  - Add a per-email lockout-free design: limit on (email, IP) plus a global per-IP-/64 limit.
  - Make the welcome grant contingent on email verification or on device attestation (App Attest / Play Integrity) for mobile registrations.
  - Add a disposable-domain blocklist.
  - Track an alert metric "grants per hour".
  - Decide Q6 (enumeration) with this abuse in view, not only for parity.

**M6. SSRF and unbounded fetch through `file` part URLs are carried into the public API.** Sections: API conventions "Strictness", turn body ("today's schema minus id").
- Problem: the turn schema accepts any URL for file parts (`app/(chat)/api/chat/schema.ts:31`, `url: z.string().url()`). The server fetches them for text and docx inlining and reads the whole body into memory (`lib/ai/text-attachments.ts:154-160`, `lib/ai/docx-extract.ts:59-63`), then hands the content to the model, which echoes it back to the caller. Image and PDF URLs are forwarded to providers.
- With a documented public API this becomes an open fetch proxy with a memory-exhaustion vector. The plan re-specifies this body for v1 without restricting it.
- Fix: in the v1 turn schema, accept only URLs on the app's Blob host that the caller uploaded (a path prefix or a DB lookup of the user's upload ids). Better still, accept `uploadId` instead of a URL. Cap fetch size and time. Add a test that a foreign URL gets 400.

**M7. "Open sets" for enums and error codes are not expressible to spec-only native clients, and the web client may validate outputs strictly.** Sections: D11, Versioning policy items 4 and 9, Goal 1 ("consumable by native clients through the OpenAPI document alone").
- Problem: zod `z.enum` becomes JSON-Schema `enum`. Typical Swift and Kotlin generators turn it into closed enums that fail to decode an unknown value [INF/UNVERIFIED per generator]. The rule "new output enum values are additive" therefore breaks exactly the clients the plan targets.
- On the web, oRPC ships an opt-in `ResponseValidationPlugin` that throws `ValidationError` when an output does not match the contract (`@orpc/contract@1.15.7 dist/plugins/index.d.mts:27-41`, dashboard store). If anyone enables it on `OpenAPILink`, a stale tab breaks on every additive enum value.
- `frozen-surface.test.ts` checks that enum values do not disappear, but nothing checks that clients tolerate new ones.
- Fix:
  - Emit output enums as `type: string` plus `x-known-values` / description, or as `anyOf: [enum, string]`, through the schema converter. Generate one Swift or Kotlin client in CI (S-spike) and decode a payload with an unknown value.
  - Ban `ResponseValidationPlugin` on clients in the boundary test.
  - Do the same for error `code`.

**M8. The parts of v1 that old mobile builds depend on most are unversioned: the AI SDK stream protocol and the message parts.** Sections: D8, Versioning policy, endpoint `GET /chats/{chatId}/messages`, risk "`ChatMessage` type derived from server tools".
- Problem: the turn and resume responses are the AI SDK UI-message stream (`x-vercel-ai-ui-message-stream: v1`, `node_modules/ai/dist/index.mjs:4706`). Their part types include tool names (`tool-generateImage`, …) and the app's data parts.
- `GET /messages` returns the stored `parts`, typed from the server tool code (`lib/types.ts:3-13`).
- None of this is in the OpenAPI snapshot ("spec post-processing adds the two SSE paths" by hand). An AI SDK major upgrade, a tool rename or a new data part therefore breaks months-old mobile builds without any test failing. The plan's breaking-change rules and `frozen-surface.test.ts` cannot see it.
- Fix:
  - Define a v1 `ChatMessage`/`MessagePart` zod schema in `core` now, as a discriminated union with an `unknown` fallback part, and use it for `GET /messages` output.
  - Pin "AI SDK stream protocol v1" as part of the v1 contract. Add a golden-stream fixture test (`MockLanguageModelV3`) that fails when the SSE part names or shapes change.
  - Make "tool renames are breaking" an explicit rule.
  - Require an AI SDK major bump to go through v2 or an adapter.

**M9. The Phase 0 safety net does not work as written: "assertion files byte-identical across moves" cannot hold with module-path mocks.** Sections: D17, Phase 0, Phases 3-4 verification (`git diff --stat tests/characterization` shows only `targets.ts`).
- Problem: the existing pattern mocks by module path (`vi.mock("@/lib/db/connection")`, `research-tests-tooling.md`). `vi.mock` is hoisted above imports, so its specifier cannot come from `targets.ts` (`vitest/dist/index.d.ts:292`, "hoisted … you don't have access to variables").
- Every Phase 4 move of `lib/db`, `lib/billing` or `app/(auth)/auth` changes mocked paths inside the characterization files. Either the verification gate fails, or people "fix" the tests, which is exactly what the rule was meant to prevent.
- Fix, one of:
  - (a) Characterization tests use `vi.doMock(targets.db, …)` plus a dynamic `await import(targets.handler)`, so all paths live in `targets.ts`.
  - (b) Pin the riskiest flows (CloudPayments webhook, chargeUsage, auth) with the real-Postgres `integration` project instead of mocks, and move that project to Phase 0, not Phase 6.
  - (c) Relax the rule to "only `vi.mock` specifier lines may change", enforced by a diff script.

**M10. The Phase 8 cutover of the money path has no instant rollback.** Sections: Phase 8, Rollback.
- Problem: Phase 8 changes several things on the path that charges money:
  - the `prepareChatTurn` signature (`session` → `Principal`);
  - the error envelope;
  - 402;
  - the model validation (`string` → `MODEL_UNAVAILABLE`);
  - the tracing-includes key.
- Rollback is "revert web-transport PR", which needs a deploy, and open tabs keep the bundle they loaded.
- Fix:
  - Put the web transport URL (legacy vs v1) behind a Vercel Flag, so the switch is reversible without a deploy.
  - Ramp by user (testers first).
  - Add a reconciliation check during the ramp: turns persisted with a `modelId` but no `Transaction` row, per route, per hour.
  - Verify the PDF fonts and watermark on the v1 route through a tracing test, not just a manual check.

**M11. Preview deployments run migrations, and the plan uses that as verification. If previews point at the production DB, unmerged migrations land in production.** Sections: Phases 3, 4, 6, 10 verification ("preview deploy runs migrator before merge").
- Evidence [OBS]: `package.json:7` `"build": "tsx lib/db/migrate && next build"`. `lib/db/migrate.ts:10-24` migrates whatever `POSTGRES_URL` says, with no environment guard.
- Owner memory says the admin dashboard reads prod Neon. Whether the Preview env has its own Neon branch is UNVERIFIED.
- If it does not, the preview of the draft `0047` or `0048` PR mutates production. A later edit to the migration file then breaks the journal hash.
- Fix: before Phase 1 (which carries `0046`), confirm that Preview `POSTGRES_URL` is a Neon branch. Add a guard in `migrate.ts`: refuse when `VERCEL_ENV=preview` and the host equals the production host. Write the rule "never edit a migration after its PR has a preview" into the plan.

**M12. Account deletion is missing from the mobile API.** Sections: Endpoint table, Auth endpoints, Non-goals.
- Problem: an app that offers account creation must offer in-app account deletion to pass App Store review (Apple guideline 5.1.1(v), from memory, UNVERIFIED in this session). The plan has `register` but no `DELETE /me`. Cascades over `Balance`, `Transaction`, `PaymentIntent`, active CloudPayments subscriptions and blobs are non-trivial for a money app (refunds, keeping financial records).
- Fix: add `POST /api/v1/me/deletion` (asynchronous, re-authenticated with the password). It cancels the CloudPayments subscription, anonymizes the user and keeps `Transaction` rows for accounting. Schedule it before Phase 13 and test it in the integration project.

### Minor

**m1. Wrapper rule for server actions rests on an unverified mechanism, and its "zero hits" metric proves nothing.** Section: Server actions migration, Phase 12.
- Next documents that action IDs change on new builds and rotate within 14 days, and that unused actions are removed from client bundles (`node_modules/next/dist/docs/01-app/02-guides/server-actions.md:174`, `data-security.md:284-290`).
- A stale tab whose ID no longer resolves never reaches the wrapper, so the `[legacy-action]` count stays at zero whether or not users are hurt.
- Phase 3 also moves `actions.ts`.
- Fix: handle "Failed to find Server Action" in the web UI (toast plus reload). Rely on Skew Protection (Q8). Gate Phase 12 for actions on the error rate of that message, not on wrapper hits.

**m2. Per-email login limit (10 per 15 min) lets anyone lock a victim out.** Section: Auth endpoints. Fix: key on (email, IP) and add a looser per-email ceiling with progressive delay rather than a hard block.

**m3. A hidden model is silently swapped for the default, so a user may be billed for a model they did not choose.** Evidence [OBS]: `resolve-mode.ts:11-15`. An old mobile build that sends a model hidden later gets `DEFAULT_CHAT_MODEL` at another price, not the `MODEL_UNAVAILABLE` the plan promises. Fix: in v1, unknown and hidden models both return `MODEL_UNAVAILABLE` with `data.suggestedModelId`; the legacy route keeps the swap.

**m4. The `timingSafeEqual` swap can turn a malformed signature into a 500.** Evidence [OBS]: `app/api/webhooks/cloudpayments/route.ts:24-37`. Node's `timingSafeEqual` throws on a length mismatch. Fix: compare decoded buffers after a length check and keep the `{code:13}` 401 path. Add a test with a short signature. Keep the `?type=` query routing (`:38-52`) untouched by the Phase 4 move.

**m5. Phase 1 secret hardening can stop production jobs.** Treating `CRON_SECRET` unset as a 500 (`app/api/cron/*/route.ts`, e.g. `reset-quotas:121`) and rejecting Resend webhooks when `RESEND_WEBHOOK_SECRET` is unset are right. If either secret is missing in Production today, quota resets and Resend events stop the moment the PR deploys. Fix: check that both secrets exist in Production with `vercel env ls` before merging, and add the step to the PR checklist.

**m6. The "optional 5-second Redis cache" for session checks contradicts "immediate revocation" in a money app.** Section: Token model. Fix: drop the cache, or invalidate it explicitly on revoke and logout-all. Throttle the `last_used_at` writes (for example once per 5 minutes).

**m7. `GET /auth/sessions` does not list web sessions, and `password/change` with `revokeOtherSessions` on a cookie principal also kills the caller.** Bumping `token_version` invalidates the caller's own cookie. Fix: document that web cookies are revoked only as a group, and re-issue the caller's session after the bump.

**m8. Payment-intent creation has no idempotency and no rate limit.** Evidence [OBS]: `app/api/payment/create-intent/route.ts:81-94` and `topup/create-intent/route.ts:88-99` insert unconditionally. Mobile retries create orphan intents, and two intents paid through two WebView sessions are two real charges. Fix: accept an `Idempotency-Key` header on `POST /payment-intents` (unique per user and key for 30 min), or reuse the open pending intent with the same kind and amount. Add a per-user limit.

**m9. Preferences: "one-time import of cookies on first GET" is a write on GET.** The plan itself flags `/api/payment/status` for doing this. Fix: import on the first `PATCH` or in the layout's server action replacement, not in `GET`.

**m10. Draft-phase v1 changes break stale web tabs, because the web runs on v1 (D7).** The skew analysis covers only legacy routes and actions. Fix: apply "additive only" to v1 from the day the web switches to it (Phase 7), not from mobile GA. Keep "draft" only for endpoints no client calls yet.

**m11. SSE path entries are patched into the spec by hand.** Section: Phase 8. They will drift from the zod turn schema. Fix: generate those path objects from the same `core` zod schema with the configured converter, and include them in the snapshot test.

**m12. No CORS policy is stated.** An Expo web build or another origin calling the API with cookies needs an explicit decision. Fix: state "no CORS for v1 except a configured allow-list, and never `Access-Control-Allow-Credentials` with a wildcard". Add an HTTP test.

**m13. HS256 `API_TOKEN_SECRET` has no rotation story.** Fix: put `kid` in the header and accept a current and a previous secret, so the key can be rotated without logging out every mobile user.

**m14. The catch-all has `maxDuration 60` and bundles every v1 procedure into one function.** Bulk deletes (`DELETE /chats?confirm=true` with blob cleanup) and subscription cancel (two CloudPayments calls) run under 60 s, where legacy routes use the project default. Fix: measure them in S3/S4, or move bulk deletes to a background `after()` job and return 202.

## Unverified assumptions the plan depends on

- Preview deployments use a separate database (a Neon branch), not production (M11).
- Production Redis is configured as Upstash REST (`KV_REST_API_*` or an https `REDIS_URL`), so the limiters and Redis turn slots are actually active (M5). Without it, turn slots fall back to per-process memory (`lib/billing/turn-slots.ts:225-226`), which weakens the spend gate across instances.
- `CRON_SECRET` and `RESEND_WEBHOOK_SECRET` are set in Production (m5).
- Vercel Skew Protection is available or enabled (Q8, m1).
- Native OpenAPI generators (Swift, Kotlin) reject unknown string-enum values (M7). This depends on the generator.
- Apple guideline 5.1.1(v), in-app account deletion (M12), is from memory.
- The AI SDK sends a `trigger` field that the server can use to tell submit from regenerate (M4). Not checked in `HttpChatTransport`.
- `@orpc/openapi` 1.16.2 handler and generator APIs, error encoding, `File` input and `ResponseValidationPlugin` defaults on `OpenAPILink`. Only 1.15.7 contract plugins were inspected, in the dashboard's store.
- Next.js precedence between the `api/v1/[[...rest]]` catch-all and `api/v1/chats/[chatId]/turns/route.ts`, including 405 on other methods (S3).
- `useChat` / `DefaultChatTransport` work in React Native against the raw stream with bearer headers (S10).
- The Vercel request-body limit for 10 MiB multipart uploads through a function (S4).
- The flags SDK's `getToken`-based `identify` returns null rather than throwing when it meets a non-NextAuth bearer JWS (S7); `isTopupEnabled` fails closed.
- CloudPayments in a WebView, and App Store / Google Play digital-goods policy for Russian users (Q11).

## Missing from the plan

- A turn-idempotency and resume-not-retry contract for mobile (M4), and a client-abort-still-charges test on the v1 route.
- A reconciliation or alerting metric for charges during every money-path cutover (Phases 7e and 8): turns without a `Transaction` row, intents without a webhook.
- A production check that the limiters exist (M5) and an environment guard for migrations (M11).
- An account-deletion endpoint (M12).
- A versioned message-part schema and a golden stream fixture (M8).
- A decision on CORS (m12) and on rotating the token secret (m13).
