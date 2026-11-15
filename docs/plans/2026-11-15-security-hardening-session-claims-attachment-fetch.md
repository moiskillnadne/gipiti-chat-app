---
date: 2026-11-15
status: done
branch: claude/amazing-gagarin-974293
session: 59d28d06-9145-4755-b264-079e18164587
---

# Security hardening: session claims, attachment fetch, webhook and cron secrets

## Context

A research pass for the (not yet approved) oRPC roadmap found security weaknesses in the code as it
is today. They do not depend on that migration. This plan fixes each one as a small behaviour
change with its own unit test. No restructuring, no oRPC, no DB migration.

Each finding was checked against the code first. Result of that check:

| # | Finding | Real? | Actual impact today |
|---|---------|-------|---------------------|
| 1 | Client can set `emailVerified` / `hasActiveSubscription` in its own JWT | Yes | Low. Readers are UI only: the reward/quiz banners on `/subscription`, the redirect on `/subscription/verify-email`, the plan caption in the sidebar. `proxy.ts` only checks that a token exists. Every money decision (email bonus, quiz bonus, free-user check) reads the DB. Still a trap for future code. |
| 2 | Server fetches any URL from a file part | Yes | Real SSRF: an authenticated user can make the server GET any URL and get the body back through the model (text and .docx parts), with no size cap or timeout. A third fetch site exists that the brief did not list: `fetchImageBytes` in `app/(chat)/api/chat/_lib/image/providers.ts` downloads the latest image in the chat, which can be a user file part. |
| 3 | CloudPayments signature compared with `===` | Yes | Low in practice (remote timing attack on an HMAC), cheap to harden. |
| 4 | Secrets accepted when unset | Yes | All four cron routes accept `Authorization: Bearer undefined` when `CRON_SECRET` is unset. The Resend webhook skips verification when `RESEND_WEBHOOK_SECRET` is unset and forwards the email. |
| 5 | Rate limiters silently off | Yes | All four limiters return success when no Upstash REST client exists. `.env.example` documents `UPSTASH_REDIS_REST_*`, which the code never reads. |
| 6 | Build runs migrations with no environment guard | Yes (report only) | Depends on Vercel settings, see report. |

## Changes

### 1. Session claims (`fix(auth)`)

- `app/(auth)/auth.ts`: in the `jwt` callback keep the existing DB re-read on `trigger === "update"`
  and delete the block that copies `session.emailVerified` / `session.hasActiveSubscription` into
  the token. Remove the `console.log` calls in the `jwt` and `session` callbacks.
- Callers: `app/subscription/verify-email/_components/verify-email-client.tsx` and
  `app/(auth)/manage-subscription/hooks/use-payment.ts` call `update({})` instead of sending
  claims. Departure from the brief ("send no payload"): `update()` with no argument is a plain GET
  in next-auth and does **not** set `trigger: "update"`, so the token would never be refreshed. An
  empty object keeps the POST and carries no claims.
- Test `app/(auth)/__tests__/auth-jwt-callback.test.ts`: mock `next-auth` to capture the config,
  mock the two DB queries, call `callbacks.jwt` with `trigger: "update"` and a hostile `session`
  payload, assert the token holds the DB values.

### 2. Attachment fetch policy (`fix(chat)`)

- New `lib/attachments/attachment-fetch-policy.ts` (single policy module):
  - `isAllowedAttachmentUrl(url)`: `https:` only, host must be the app's Blob store
    (`<storeId>.public.blob.vercel-storage.com`, store id taken from `BLOB_READ_WRITE_TOKEN` the
    same way `@vercel/blob` does). Without a token (tests, local dev without Blob) it falls back to
    any `*.public.blob.vercel-storage.com` host.
  - `fetchAttachmentBytes(url, { maxBytes, timeoutMs, signal })`: host check, `redirect: "error"`,
    timeout, `Content-Length` pre-check, then a streamed read that stops at `maxBytes`. Throws
    `AttachmentFetchError` with a reason.
  - Default cap is 3 × `MAX_ATTACHMENT_BYTES` (30 MB): the upload route re-encodes Windows-1251
    text to UTF-8, so a legitimate 10 MB upload can be stored larger than 10 MB.
- Use it in `lib/ai/text-attachments.ts` (`fetchAndFormat`), `lib/ai/docx-extract.ts`
  (`fetchAndExtract`) and `fetchImageBytes` in `app/(chat)/api/chat/_lib/image/providers.ts`.
  Existing "could not read file" fallbacks stay as they are.
- `app/(chat)/api/chat/schema.ts`: the file part `url` must pass `isAllowedAttachmentUrl`, so new
  messages cannot carry a foreign URL (also covers image and PDF parts, which go to the gateway).
  Stored messages are not re-validated by this schema; their Blob URLs pass the fetch-time check.
- Tests: `lib/attachments/__tests__/attachment-fetch-policy.test.ts` (foreign host, `http:`,
  look-alike host, wrong store, oversize by header, oversize by stream, timeout, happy path);
  a case in `lib/ai/__tests__/text-attachments.test.ts` and a new docx case proving a foreign URL
  is never fetched; a schema test rejecting a foreign URL.

### 3. CloudPayments signature (`fix(payments)`)

- New `app/api/webhooks/cloudpayments/lib/signature.ts`: `isValidWebhookSignature(body, signature,
  apiSecret)` decodes both base64 values, checks length, then `crypto.timingSafeEqual`.
  `route.ts` calls it; URL, payload handling and response codes are untouched.
- Test next to it: valid, tampered body, wrong length, empty and missing signature, and that
  `timingSafeEqual` is what does the comparison.

### 4. Cron and Resend secrets (`fix(api)`)

- New `lib/cron/is-authorized-cron-request.ts`: false when `CRON_SECRET` is unset or empty,
  otherwise a timing-safe compare of the `Authorization` header. Used by the four
  `app/api/cron/*/route.ts` files (two lines each).
- `app/api/webhooks/resend/route.ts`: with no `RESEND_WEBHOOK_SECRET`, log an error and reject
  (same 400 as an invalid signature) instead of parsing the payload.
- Tests: helper unit test; a case in `app/api/cron/reset-quotas/__tests__/route.test.ts`
  (`Bearer undefined` with the secret unset gives 401); a Resend route test (unset secret gives 400
  and nothing is forwarded).

### 5. Rate limiter visibility (`feat(health)`)

- `lib/rate-limit.ts`: export `isRateLimitingEnabled()`; replace the per-call warnings with one
  warning per server instance. Fail-open behaviour is unchanged.
- `app/api/health/route.ts`: add `checks.rateLimiting: { enabled: boolean }`. Overall status and
  HTTP codes do not change. Update the schema in `lib/agent-discovery/openapi.ts`.
- `.env.example`: replace the unread `UPSTASH_REDIS_REST_*` names with `KV_REST_API_URL` /
  `KV_REST_API_TOKEN`.
- Tests: `lib/__tests__/rate-limit.test.ts` (disabled flag, single warning) and a health route test.

### 6. Build-time migrations

Report only, no code change.

## Order of work

One commit per finding, in the order 3, 4, 1, 5, 2 (smallest first, the attachment change last
because it touches the chat path). `pnpm check:fast` after each, full `pnpm check` at the end.
Nothing is pushed and no PR is opened.

## Risks

- **Finding 2, store pinning.** If the token-to-host derivation were wrong, every attachment would
  stop being read. Checked during implementation against the real store behind the local
  `BLOB_READ_WRITE_TOKEN`: the host of every listed blob equals the lower-cased store id from the
  token, blobs are served without a redirect, and a real blob downloads through the policy. So the
  policy pins to the app's own store. Attachments uploaded to a previous Blob store, if one ever
  existed, are no longer read by the model, and a message carrying one cannot be re-sent.
- **Finding 4, Resend.** If `RESEND_WEBHOOK_SECRET` is not set in production, inbound mail
  forwarding stops after deploy. The owner must confirm it is set before this ships. Same for
  `CRON_SECRET` (Vercel Cron only sends the header when the variable exists).
- **Finding 5.** The health endpoint is public; the new field states openly that limiting is off.
  The existing `configured` list already reveals the same thing.

## Verification

- New unit tests listed above; each is written to fail against the current code.
- `pnpm check` (typecheck, Biome, unit tests, build) green.
- Not covered: a live run against CloudPayments, Resend or Vercel Cron. Those need the owner's
  environment.
