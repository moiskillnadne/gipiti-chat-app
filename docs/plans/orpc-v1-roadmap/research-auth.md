# Research: authentication & sessions — current state and mobile-capable options

Scope: GIPITI app (`/Users/victorryabkov/projects/personal/gipiti/app`), read-only investigation, 2026-11-15.
Evidence is cited as repo-relative `path:line`. **Observed** = read in code / installed package. **Inferred** = my reasoning. **UNVERIFIED** = could not confirm against installed code or docs.

Installed versions (observed, `package.json`): `next` 16.4.6, `next-auth` 5.0.0-beta.32 (resolves `@auth/core` 0.41.3 via `node_modules/.pnpm/next-auth@5.0.0-beta.32*/node_modules/@auth/core -> @auth+core@0.41.3`), `bcrypt-ts` ^5.0.2, `zod` ^3.25.76 (not Zod 4 as the main import; `zod/v4` subpath exists in 3.25 — UNVERIFIED whether the app uses it), `flags` ^4.2.0, `@upstash/ratelimit` ^2.0.8. No `@orpc/*`, no `jose`, no `better-auth` as direct deps.

---

## 1. Current state

### 1.1 Files and roles

| File | Role (observed) |
|---|---|
| `app/(auth)/auth.config.ts:3-13` | Edge-safe config: `pages.signIn="/login"`, `newUser="/"`, no providers, empty callbacks. Not imported by `proxy.ts` (proxy uses `getToken` directly). |
| `app/(auth)/auth.ts:17-147` | `NextAuth({...})` → exports `GET, POST, auth, signIn, signOut`. One `Credentials` provider. JWT strategy (no adapter → default `jwt`, `@auth/core/lib/init.js:74`). |
| `app/(auth)/api/auth/[...nextauth]/route.ts:1-2` | Re-exports `GET, POST` — the NextAuth HTTP surface (`/api/auth/*`: csrf, session, callback/credentials, signout). |
| `app/(auth)/actions.ts` (455 lines, `"use server"`) | Server actions: `login`, `register`, `verifyEmail`, `resendVerificationCode`, `requestPasswordReset`, `resetPassword`. |
| `proxy.ts:47-139` | Next 16 middleware: markdown rewrite, signup gate, protected-route redirect, auth-route bounce. |
| `lib/auth/normalize-email.ts:15-17` | `trim().toLowerCase()`; deliberately no plus/dot stripping. |
| `lib/auth/reset-token.ts` | `randomBytes(32)` hex tokens, SHA-256 hash for storage, `timingSafeEqual` verify (`:28-41`), 1h default expiry (`:48`). Also used to hash 6-digit codes. |
| `lib/auth/secret.ts:5-19` | `AUTH_SECRET ?? NEXTAUTH_SECRET`; dev fallback constant `"development-auth-secret"`; throws in prod if unset. |
| `lib/auth/__tests__/normalize-email.test.ts` | Only unit test under `lib/auth`. |
| `types/next-auth.d.ts:6-44` | Augments `Session.user`, `User`, `JWT` with `id, type ("regular"), emailVerified:boolean, hasActiveSubscription, isTester`. |
| `lib/flags.ts:8-51` | `isSignupEnabled` (fail-open, default true) and `isTopupEnabled` (fail-closed, identifies user via `getToken` from headers). |
| `lib/rate-limit.ts` | Upstash limiters; all fail open when Redis absent or erroring. |
| `components/sign-out-form.tsx:5-25` | Server-action sign-out form. **Not used anywhere** (grep finds only its own definition) — dead code. |
| `components/sidebar-user-nav.tsx:46` | The real sign-out: client `signOut({ redirectTo: "/login" })` from `next-auth/react`. |

### 1.2 Login (Credentials)
Observed, `app/(auth)/auth.ts:43-76`:
1. `getUserByEmail(email)` — case-insensitive lookup `lower(email) = normalizeEmail(input)` (`lib/db/query/user/get-by-email.ts:12`).
2. User missing **or** user has no password → `await compare(password, DUMMY_PASSWORD)` then `null` (`:47-55`). Equalises bcrypt timing against user enumeration. `DUMMY_PASSWORD` generated at module load (`lib/constants.ts:15`).
3. `compare(password, userRecord.password)`; mismatch → `null`.
4. Extra DB read: `getActiveUserSubscription` to snapshot `hasActiveSubscription` (`:64-66`).
5. Returns `{id, email, type:"regular", emailVerified, hasActiveSubscription, isTester}`.

Server action `login` (`app/(auth)/actions.ts:61-89`) validates with zod (`email()`, `password.min(1)`), calls `signIn("credentials", {redirect:false})`, maps any error to `{status:"failed"}` — no distinction between wrong password and unknown user (good). Logger suppresses `CredentialsSignin` noise (`auth.ts:26-31`).

Client (`app/(auth)/login/login-page-client.tsx:60-120`): `useActionState(login)`, then `updateSession()` and `router.replace(callbackUrl)`; callbackUrl restricted to same-origin paths (`:62-87`).

Password hashing: `bcrypt-ts` `genSaltSync(10)` + `hashSync` (`lib/db/utils.ts:4-9`). Cost 10.

**No rate limiting on login** (observed: `lib/rate-limit.ts` has only chat, password-reset, verification-resend, payment-status limiters). Online password guessing is bounded only by bcrypt cost.

### 1.3 Registration
`app/(auth)/actions.ts:102-171`:
- Flag gate first: `if (!(await isSignupEnabled())) return {status:"failed"}` (`:108`). Also gated at the page level in `proxy.ts:64-69` (redirect `/register` → `/login`).
- Strict password policy (`:43-55`): ≥8, upper, lower, digit, special.
- Pre-check `getUserByEmail` → `{status:"user_exists"}` (`:117-121`). **This discloses account existence** (user enumeration via signup). The race is closed by the functional unique index `user_email_lower_unique_idx` (`lib/db/schema.ts:63-65`) → `DuplicateEmailError` (`lib/db/query/user/create-user.ts:23-28,67-69`).
- Reads UTM cookie `UTM_COOKIE_NAME` and deletes it after attribution (`:124-145`); geo from Vercel IP headers + `language` hidden field (`:132-133`).
- `createUser` (`lib/db/query/user/create-user.ts:30-86`): insert normalized email + bcrypt hash; `ensureBalance(RUB)`; `creditBalance({pool:"topup", type:"welcome", amount: 50 RUB})`. Note: insert and grant are **not** in one DB transaction (inferred from code: separate awaits, `:42-83`); a crash between them yields a user without welcome grant (never a double grant).
- Auto sign-in via `signIn("credentials")` (`:148-152`). **No verification email is sent at registration** — verification is opt-in, triggered from the reward banner (`app/subscription/_components/reward-banner.tsx:26-29,67-76`) which calls `resendVerificationCode`. (Git history: `001dc21 Remove confirmEmail page during signup process`.)
- **No rate limiting on register** (per IP or otherwise).

### 1.4 Email verification (6-digit code)
- Code: `randomInt(100_000, 999_999)` (`lib/email/send-verification-email.ts:19-22`) — note upper bound is exclusive, so 999999 is never generated (cosmetic). Stored as SHA-256 hash with 30-min expiry (`:28-41`, `setEmailVerificationCode`).
- `resendVerificationCode` (`app/(auth)/actions.ts:261-308`): takes `email` **from the form body (hidden field), not from the session**; rate limit 1/60s fixed window per lower-cased email (`lib/rate-limit.ts:30-35`); returns `success` for unknown or verified emails (anti-enumeration, `:284-287`). Inferred: any anonymous caller can trigger a code email to any registered unverified address once per minute (spam vector, low).
- `verifyEmail` (`:191-243`): **no session required, no attempt limit.** Looks up the user **globally by code hash** (`lib/db/query/user/get-user-by-verification-code.ts:12-20`: `WHERE email_verification_code = hash AND expiry > now()`), then checks `foundUser.email === input.email`. On success: `markEmailAsVerified` and best-effort `grantEmailVerificationBonus` (100 RUB, idempotent, row-locked — `lib/billing/balance.ts:400-462`).
  - Inferred risk: with ≤900k code space, 30-min window and no attempt cap, a scripted attacker can brute-force the code for an address they registered but cannot read (e.g. a non-existent mailbox) and collect the 100 RUB email bonus + unlock the 50 RUB quiz bonus. Server actions are callable by script (Origin missing → only a warning, `node_modules/next/dist/server/app-render/action-handler.js:436-441`). Also, a global lookup means two users with the same live code collide (first row wins → "invalid_code" for the other) — rare but real.
  - `expired_code` status exists in the type (`:186`) but is never returned.
- Client `verify-email-client.tsx:64-70,103-112` calls the action then `update({ emailVerified: true })` to push the new value into the JWT (see §1.7 — client-controlled).

### 1.5 Password reset
- `requestPasswordReset` (`:326-385`): rate limit 5/h per email (`lib/rate-limit.ts:23-28`); always `success` for unknown email (anti-enumeration, `:351-353`); stores SHA-256 of a 32-byte token, 1h expiry (`setPasswordResetToken`); emails plain token link.
- `resetPassword` (`:412-455`): global lookup by token hash + expiry (`lib/db/query/user/get-user-by-reset-token.ts`), strict password policy, `updateUserPassword` clears token (`lib/db/query/user/update-user-password.ts:15-21`), sends "password changed" email.
- Reset page reads `?token=` from the URL (`app/(auth)/reset-password/page.tsx:55`).
- **Existing sessions are not invalidated** after reset (stateless JWT, no version claim). A stolen 30-day cookie survives a password reset. Inferred.
- No "change password while logged in" feature exists (grep: no such action/route).

### 1.6 Sign-out
Client `signOut()` from `next-auth/react` (`components/sidebar-user-nav.tsx:46`) → POST `/api/auth/signout` (CSRF-token validated, `@auth/core/lib/index.js:63-64`) → deletes the cookie. Server-side nothing is revoked (JWT). `components/sign-out-form.tsx` is unused.

### 1.7 The JWT: contents, lifetime, snapshot vs DB

Observed:
- Format: JWE, `alg:"dir"`, `enc:"A256CBC-HS512"`, key derived by HKDF from `AUTH_SECRET` with **salt = cookie name** (`@auth/core/jwt.js:46-53,86,116-128`). Encrypted, not just signed.
- Cookie: `__Secure-authjs.session-token` in prod (`authjs.session-token` in dev), `httpOnly`, `sameSite:"lax"`, `path:/` (`@auth/core/lib/utils/cookie.js:44-56`). CSRF cookie `__Host-authjs.csrf-token` (`:66-69`).
- Lifetime: `maxAge` 30 days, sliding (`updateAge` 24h) — defaults, the app sets no `session` option (`@auth/core/lib/init.js:38,75-76`; `app/(auth)/auth.ts` has no `session:` key).
- Claims: default (`name/email/picture/sub`, `iat/exp/jti`) + custom `id, type, emailVerified, hasActiveSubscription, isTester` (`auth.ts:80-88`, `types/next-auth.d.ts:27-35`).
- `trigger === "update"` (`auth.ts:91-129`): re-reads subscription and user from DB, **then overwrites `emailVerified` and `hasActiveSubscription` with whatever the client sent** in `session` (`:116-126`). `useSession().update(data)` POSTs `data` to `/api/auth/session` (`@auth/core/lib/index.js:58-59`, CSRF-checked). Callers: `verify-email-client.tsx:108` (`{emailVerified:true}`), `use-payment.ts:66` (`{hasActiveSubscription:true}`), `login-page-client.tsx` / `register-page-client.tsx` (no data).
  - Consequence (inferred): a user can set their own `emailVerified`/`hasActiveSubscription` JWT claims to `true`. Impact today is **UI only**, because every money/entitlement decision reads the DB: quiz bonus (`app/(chat)/api/quiz/[key]/route.ts:56-67` + `grantQuizBonus → assertEmailVerified`, `lib/billing/balance.ts:479`), tester min top-up (`app/api/topup/create-intent/route.ts:46-51`), tester plans (`app/api/payment/create-intent/route.ts:52-57`), webhooks (`app/api/webhooks/cloudpayments/lib/handlers/check.ts:41-61`). Session-field consumers are only `app/subscription/page.tsx:162,173`, `app/subscription/verify-email/page.tsx:19`, `components/sidebar-user-nav.tsx:31-33`, `app/(auth)/manage-subscription/manage-subscription-page-client.tsx:51`.
  - Many `console.log` calls leak session data to logs (`auth.ts:92-95,109,117-120,128,141`).
- Snapshot vs DB (observed): login-time snapshots = all five custom claims; refreshed only on `update` trigger. CLAUDE.md already states "read the DB for runtime tier decisions" and the code follows it. `GET /api/me` (`app/api/me/route.ts:8-48`) returns DB-fresh `id, email, emailVerified, isTester, hasActiveSubscription, balance` — the natural seed for `/v1/me`.

### 1.8 Every call site of `auth()` / session access

Observed via grep (tests excluded): **42 `await auth()` calls in 34 files**:
- **Pages (10):** `app/(chat)/chat/page.tsx:7`, `chat/[id]/page.tsx:22`, `projects/page.tsx:7`, `projects/[id]/page.tsx:14`, `prompts/page.tsx:7`, `app/subscription/page.tsx:58`, `subscription/usage/page.tsx:12`, `subscription/verify-email/page.tsx:10`, `subscription/manage/page.tsx:45`, `app/(auth)/manage-subscription/page.tsx:7`.
- **Route handlers (31):** `app/(chat)/api/chat/route.ts:78,339`; `chat/[id]/stop/route.ts:20`; `chat/[id]/stream/route.ts:33`; `vote/route.ts:18,54`; `history/route.ts:22,43`; `projects/route.ts:31,46,79,114`; `projects/[id]/files/route.ts:42,63`; `projects/[id]/files/[fileId]/route.ts:12`; `files/upload/route.ts:78`; `quiz/[key]/route.ts:14,29`; `usage/route.ts:9`; `subscription/route.ts:33,62`; `subscription/resume/route.ts:10`; `subscription/cancellation-feedback/route.ts:40`; `transactions/route.ts:8`; `prompts/route.ts:7`; `prompts/favorite/route.ts:12,37`; `app/api/me/route.ts:9`; `app/api/payment/create-intent/route.ts:26`; `app/api/payment/status/route.ts:14`; `app/api/topup/create-intent/route.ts:34`.
- **Server actions (1):** `app/(chat)/actions.ts:90` (`deleteTrailingMessages`). The other 11 actions in that file only set preference cookies (`:19-87`) — no auth, cookie-only state that a mobile client cannot use.
- Pattern: almost uniformly `const session = await auth(); if (!session?.user) return 401 / ChatSDKError("unauthorized:...")` then `session.user.id`. Unauthorized response shapes are inconsistent: plain-text `"Unauthorized"` 401 (`app/api/me/route.ts:11`, payment, topup) vs `ChatSDKError(...).toResponse()` (chat APIs).
- **`getToken` (2):** `proxy.ts:111-115`, `lib/flags.ts:29-33` (`isTopupEnabled` user targeting).
- **Client `useSession` (6 files):** `verify-email-client.tsx:54`, `top-up-dialog.tsx:60`, `manage-subscription-page-client.tsx:49`, `use-payment.ts:54`, `register-page-client.tsx:58`, `login-page-client.tsx:60`; plus `sidebar-user-nav.tsx:15`.
- Type-only imports of `UserType` from `@/app/(auth)/auth`: `lib/ai/entitlements.ts:1`, `contexts/model-context.tsx:14` (a `lib/` → `app/` dependency to clean up in the restructure).
- Tests mock the module: `vi.mock("@/app/(auth)/auth", () => ({ auth: vi.fn() }))` in `app/api/payment/create-intent/__tests__/route.test.ts:17`, `app/(chat)/api/quiz/[key]/__tests__/route.test.ts:12`, `app/(chat)/api/subscription/__tests__/route.test.ts:7`. E2E: `tests/e2e/login.test.ts`, page object `tests/pages/auth.ts`.

Important library facts for the migration (observed):
- `auth()` in next-auth builds its request **only from the `cookie` header** (`next-auth/lib/index.js:12`). It never reads `Authorization`. So no existing route can accept a bearer token without changing the call site.
- `getToken()` **does** fall back to `Authorization: Bearer <token>` when no cookie is present (`@auth/core/jwt.js:91-101`). So `proxy.ts` and `lib/flags.ts#identifyUser` already accept a NextAuth JWE as a bearer — an accidental, undocumented second auth path. A first-party mobile token sent there fails decode → `null` (safe), but flag targeting will not see mobile users.

### 1.9 How `proxy.ts` protects routes
- `matcher` (`proxy.ts:141-159`) excludes everything under `api/` (negative lookahead `(?!...api/...)`). **Consequence: the proxy never runs for `/api/*`**, so the branch `pathname.startsWith("/api/auth"|"/api/webhooks"|"/api/payment"|"/api/log")` (`:87-94`) is dead code. All API auth is per-handler `auth()`.
- Pages: `PROTECTED_ROUTE_PATTERNS` (`:26-32`) → redirect to `/login?callbackUrl=` when no token (`:127-131`); token on `/` → `/chat` (`:120-122`); token on auth routes → `/chat` (`:134-136`). Documented as defence in depth: each page also calls `auth()` (`:23-24`).
- Signup gate on `/register*` via `isSignupEnabled()` (`:64-69`).
- `getToken` with `secureCookie: !isDevelopmentEnvironment` (`:114`) — the reason a local `next start` over http bounces to `/login` (owner's memory note).
- Inferred: proxy only checks that a decodable JWE exists; it does not check expiry beyond JWE `exp`, revocation, or verification state.

### 1.10 CSRF posture today
- NextAuth HTTP endpoints: double-submit CSRF token required for credentials callback, session update, signin, signout (`@auth/core/lib/index.js:50-64`). Cookies `SameSite=Lax`.
- Server actions (`login`, `register`, …, `deleteTrailingMessages`, cookie setters): Next.js compares `Origin` host with `Host`/`x-forwarded-host` and rejects mismatches unless `serverActions.allowedOrigins` (`action-handler.js:434-450`). Missing `Origin` → allowed with a warning (`:436-441`), i.e. scripted (non-browser) calls are possible but carry no victim cookies.
- Server-side `signIn()`/`signOut()` calls pass `skipCSRFCheck` (`next-auth/lib/actions.js:1,44,65`) — relies on the server-action Origin check above.
- Route handlers (`/api/chat`, `/api/projects`, `/api/payment/create-intent`, `/api/topup/create-intent`, …): **no CSRF token**; protection is only `SameSite=Lax` (cross-site POST/fetch does not carry the cookie in modern browsers) plus JSON bodies (most use `request.json()`, a cross-site simple `<form>` cannot send `application/json`; but `request.json()` does not check `Content-Type`, so a `text/plain` form body containing JSON would parse — inferred). Same-site subdomains would bypass Lax (inferred; relevant only if other `*.gipiti` subdomains host untrusted content — UNVERIFIED).

### 1.11 Tester and flag cookies
- `isTester` is a DB column (`lib/db/schema.ts:35`), snapshotted into JWT, but every privileged use re-reads the DB (§1.7).
- Vercel Flags: `isSignupEnabled` fail-open (`lib/flags.ts:8-18`), `isTopupEnabled` fail-closed with user targeting (`:39-51`). The `flags` SDK honours a `vercel-flag-overrides` cookie (string present in `node_modules/flags/dist/next.*`; encrypted with `FLAGS_SECRET` per owner memory — the encryption detail is UNVERIFIED in code). `/.well-known/vercel/flags` route exists (`app/.well-known/vercel/flags/route.ts`). Mobile clients will not carry override cookies; flag evaluation for API requests must take the principal explicitly.
- UTM cookie read at registration (`app/(auth)/actions.ts:124-145`) — mobile needs UTM in the request body instead.

### 1.12 Bonuses tied to auth events and abuse protection
| Bonus | Amount | Trigger | Protection (observed) |
|---|---|---|---|
| Welcome | 50 RUB (`lib/billing/constants.ts:18`) | `createUser` (`create-user.ts:77-83`) | One account per lower-cased email (unique index); intentionally the smallest because it is farmable by throwaway addresses (`constants.ts:14-17`). No per-IP/device registration limit. |
| Email confirm | 100 RUB (`constants.ts:23`) | `verifyEmail` (`actions.ts:228-232`) | Idempotent per user (`email_bonus` transaction existence check under `FOR UPDATE`, `balance.ts:411-433`). **Weakness:** no attempt limit on code entry (§1.4). |
| Onboarding quiz | 50 RUB (`constants.ts:28`) | `POST /api/quiz/[key]` | DB-read email verification (`quiz/[key]/route.ts:59`, `balance.ts:479`), idempotent per (user, quizKey) under row lock (`balance.ts:491-519`). Note: `getQuizResponse` + `createQuizResponse` happen before the grant; the grant itself is idempotent so concurrency is safe (inferred). |

Plus-tag/dot aliasing deliberately not collapsed (`normalize-email.ts:11-13`).

### 1.13 Payments: what depends on a cookie session
- `app/(auth)/manage-subscription/page.tsx:7` (`auth()`), its client `manage-subscription-page-client.tsx:49-51` (`useSession`, `isTester` from JWT for UI).
- `app/(auth)/manage-subscription/hooks/use-payment.ts`: `useSession()` (`:51-54`) supplies **`accountId = session.user.id` and `email`** to the CloudPayments widget (`subscribe`, `:290-293` and following); calls `POST /api/payment/create-intent` and polls `GET /api/payment/status` with same-origin cookies; after success `updateSession({ hasActiveSubscription: true })` (`:66`); redirect-recovery state in `localStorage`.
- `app/subscription/_components/top-up-dialog.tsx:60,176-177,191,205-218`: same pattern — `accountId: session.user.id`, `email: session.user.email`, `POST /api/topup/create-intent`, polling `/api/payment/status`.
- `app/api/payment/create-intent/route.ts:26`, `app/api/payment/status/route.ts:14`, `app/api/topup/create-intent/route.ts:34` — `auth()` + `isTopupEnabled()` whose user targeting reads the cookie via `getToken` (`lib/flags.ts:27-37`).
- Webhooks (`app/api/webhooks/cloudpayments/*`) are session-free: HMAC-validated, resolve the user from `AccountId` and match the intent by `sessionId` + `AccountId` (`check.ts:29-61`). Good: the server trusts the intent, not the widget's accountId alone.
- The CloudPayments widget is a browser JS script (`lib/payments/cloudpayments-widget.ts`, `window.cp.CloudPayments`). A mobile app needs either a WebView hosting a payment page or CloudPayments' native SDK — choice is out of scope; native-SDK/App-Store rules for digital goods are UNVERIFIED and a product/legal risk (in-app purchase policies).
- Inferred recommendation: make the intent response self-sufficient (`publicId, accountId, email, amount, currency, description, data{kind,sessionId}, receipt`) so no client reads identity from the session; then a mobile WebView or native SDK can use it unchanged.

---

## 2. Options for mobile-capable auth

Common requirements derived from §1: bearer-capable for every API the mobile app calls; revocation (money app; tokens on lost phones); survive password reset; keep the web working throughout; hand-written SQL migrations (`lib/db/migrations/0045_*` is the latest; 46 journal entries in `lib/db/migrations/meta/_journal.json`).

### Option 1 — Keep NextAuth for web cookies + first-party token endpoints (RECOMMENDED)

Design:
- **Access token:** signed JWS (HS256 or EdDSA), 15 min, claims `sub` (user id), `sid` (session id), `ver` (user `tokenVersion`), `iss`, `aud:"gipiti-api"`, `iat/exp`. Separate secret `API_TOKEN_SECRET` (never reuse `AUTH_SECRET`, so NextAuth JWEs and API tokens can never be confused). Library: `jose` (not a direct dependency today — add it; `@auth/core` uses it transitively, UNVERIFIED which version) or `node:crypto` HMAC.
- **Refresh token:** 256-bit random opaque string, stored as SHA-256 hash (reuse `lib/auth/reset-token.ts#hashToken`), rotated on every use, 60-day sliding / 180-day absolute lifetime (product decision).
- **Reuse detection:** each rotation marks the old token `used_at`; presenting a used token revokes the whole session family (`revoked_reason='reuse'`). Allow a short grace (e.g. 30 s) for a retry of the *immediately previous* token to tolerate mobile network races — return the same new pair idempotently, not a third one.
- **Revocation:** `AuthSession.revokedAt`. Access-token verification checks `sid` against the DB (one PK lookup; cacheable a few seconds in Redis) so logout / password reset / "log out all devices" take effect immediately, not after 15 min. For a pay-per-use app this is worth one query.
- **Password reset / change:** bump `User.token_version` and revoke all `AuthSession` rows; NextAuth cookies also need invalidation — add `ver` to the NextAuth JWT in the `jwt` callback and compare in `resolvePrincipal` (DB read) so web sessions die too. This fixes §1.5.
- **One resolver:** `resolvePrincipal(request): Promise<Principal | null>`:
  1. `Authorization: Bearer` present → verify first-party JWS + session row; **never** fall back to cookies when a bearer header is present (avoid mixed-mode confusion).
  2. Else NextAuth cookie via `auth()` (cookie only, observed `next-auth/lib/index.js:12`) → map to the same `Principal`.
  `Principal = { userId, sessionId | null, via: "bearer" | "cookie", clientKind: "web" | "mobile" }` — no entitlement booleans; entitlements are read from the DB per request (consistent with CLAUDE.md).
- **Flags:** `isTopupEnabled` `identify` must accept the resolved principal (pass entities explicitly or decode bearer in `identify`), else mobile users fall into the default `false`.

DB schema (hand-written migration `0046_auth_sessions.sql` + journal entry + `lib/db/schema.ts`):
```sql
ALTER TABLE "User" ADD COLUMN "token_version" integer NOT NULL DEFAULT 0;

CREATE TABLE "AuthSession" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "client_kind" varchar(16) NOT NULL,          -- 'mobile' | 'web' (future)
  "device_name" varchar(255), "platform" varchar(32), "app_version" varchar(32),
  "created_ip" varchar(64), "last_used_at" timestamp NOT NULL DEFAULT now(),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "absolute_expires_at" timestamp NOT NULL,
  "revoked_at" timestamp, "revoked_reason" varchar(32)
);
CREATE INDEX ON "AuthSession" ("user_id") WHERE "revoked_at" IS NULL;

CREATE TABLE "RefreshToken" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" uuid NOT NULL REFERENCES "AuthSession"("id") ON DELETE CASCADE,
  "token_hash" varchar(64) NOT NULL UNIQUE,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp, "replaced_by_id" uuid
);

-- verification-code brute-force guard (or Redis counter, see below)
ALTER TABLE "User" ADD COLUMN "email_verification_attempts" integer NOT NULL DEFAULT 0;
```
Plus a cron (or piggy-back on `cleanup-payment-intents`) to delete expired/used refresh tokens.

Security properties: token theft → 15-min access window, refresh theft detected on reuse; revocation immediate (DB check); CSRF not applicable to bearer (not ambient); cookie path unchanged; enumeration unchanged (same dummy compare reused in the new login service).

Effort (inferred, solo dev): ~4-6 days for services + endpoints + migration + tests; the 42 call-site swap `auth()` → `resolvePrincipal()` is mechanical and can ride the oRPC migration of each endpoint.

Risks: own crypto/session code to maintain (mitigated by small surface and tests); NextAuth v5 is still beta (`5.0.0-beta.32`) — stays in the picture for web; two login paths (web server action / mobile endpoint) must share one `authenticateCredentials()` function so policies cannot drift.

Transition: zero web disruption. Web keeps NextAuth cookies; new `/v1/auth/*` endpoints are additive. Later, optionally, web can switch to the same endpoints with the refresh token in an `httpOnly` cookie and NextAuth is removed — a separate, later decision.

### Option 2 — Replace NextAuth with better-auth (bearer-native)

Observed (docs, `better-auth.com/docs/plugins/bearer`): bearer plugin returns a session token in the `set-auth-token` response header; server validates with `auth.api.getSession({ headers })`; option `requireSignature`. The page does **not** document refresh-token rotation or reuse detection.
UNVERIFIED (not installed, docs not read in full): DB-backed sessions with server-side revocation; custom `password.hash/verify` hooks to keep bcrypt-ts hashes; Drizzle adapter schema (`user`, `session`, `account`, `verification` tables, password stored on `account`); built-in rate limiting; email-OTP plugin; Expo integration package.

Migration cost (inferred):
- Schema: new `session`/`account`/`verification` tables, move `User.password` into `account` rows (data migration for every user), map `emailVerified`, verification/reset columns → `verification` table. better-auth expects its own column names; mapping config needed. Hand-written SQL for all of it (drizzle-kit generate is broken).
- Passwords: keep bcrypt via custom verify hook, or rehash on login (UNVERIFIED API).
- Live sessions: every NextAuth JWE cookie becomes invalid → **all users logged out** at cutover, unless a bridge decodes old cookies once and issues a better-auth session.
- Rewrite: login/register/verify/reset flows, bonus hooks (welcome grant in `createUser`, email bonus in verify), proxy, flags identify, `next-auth/react` client hooks in 7 files, 3 test mocks, E2E.
- Effort ~2-3 weeks; risk of subtle regressions in money-adjacent flows (welcome/email bonuses) and anti-enumeration behaviour.
- Upside: maintained library for sessions, possibly OAuth/passkeys later. Downside: mobile token semantics (long-lived session token, no documented rotation) are not clearly better than Option 1; a big-bang cutover on a production money app maintained by one person.

### Option 3 — Reuse the NextAuth JWT as a bearer token

Observed: `getToken` accepts `Authorization: Bearer` (`@auth/core/jwt.js:91-101`); `auth()` does not (`next-auth/lib/index.js:12`).
Problems:
- Issuance: the JWE is only produced through the NextAuth callback flow that sets a cookie; a mobile client would need to perform the CSRF dance against `/api/auth/callback/credentials` and scrape `Set-Cookie`, or the app writes a custom endpoint calling `encode()` with salt = cookie name — at which point it is Option 1 with worse tokens.
- 30-day bearer with no rotation, no reuse detection, **no revocation** (stateless), survives password reset.
- Claims are client-mutable via the `update` trigger (§1.7) and are login-time snapshots.
- Token is encrypted with a key derived from `AUTH_SECRET` + cookie name: coupling the mobile API to NextAuth internals and to the `__Secure-` prefix choice; a NextAuth upgrade can change the format and break months-old mobile builds.
- Every handler still has to change from `auth()` to a `getToken`-based resolver.
Effort smallest (~1-2 days) but security properties are unacceptable for a money balance on lost/stolen phones. **Reject.**

### Comparison

| | Opt 1 first-party tokens | Opt 2 better-auth | Opt 3 NextAuth JWE bearer |
|---|---|---|---|
| Token theft window | 15 min access; refresh rotation | session-token lifetime (UNVERIFIED) | 30 days |
| Rotation / reuse detection | yes (designed) | not documented | no |
| Revocation | immediate (DB `sid` check) | yes (DB sessions, UNVERIFIED) | no |
| CSRF | n/a for bearer; web unchanged | library-managed | n/a for bearer |
| Enumeration | reuse dummy compare | must re-verify | unchanged |
| Schema | 2 tables + 2 columns | 3-4 tables + data migration | none |
| Web during transition | untouched | big-bang cutover, users logged out | untouched |
| Effort | ~1 week | ~2-3 weeks | ~1-2 days |
| Mobile-build longevity | contract owned by us | owned by library | owned by NextAuth internals |

**Recommendation: Option 1.**

---

## 3. Auth REST endpoints (v1)

Conventions (proposed): base `/api/v1` (path prefix versioning; owner's versioning decision lives in another report), JSON bodies, error body = oRPC error JSON `{ defined, code, status, message, data }` (shape observed: `ORPCErrorJSON = Pick<ORPCError,'defined'|'code'|'status'|'message'|'data'>`, `@orpc/client/dist/index.d.mts:132`). How `OpenAPIHandler` serialises errors over REST is UNVERIFIED (package not installed). Messages are Russian user-facing strings from `messages/ru.json`; clients switch on `code` + `data.reason`, never on `message`.

Token pair shape:
```ts
type TokenPair = {
  accessToken: string; accessTokenExpiresAt: string;   // ISO
  refreshToken: string; refreshTokenExpiresAt: string;
  tokenType: "Bearer";
};
type MeResponse = {
  id: string; email: string; emailVerified: boolean; isTester: boolean;
  hasActiveSubscription: boolean;
  balance: { currencyCode: string; total: number; formatted: string } | null;
};
```

| Method + path | Auth | Request | 2xx response | Errors (code → data.reason) |
|---|---|---|---|---|
| `POST /v1/auth/register` | none | `{ email, password, language?, utm?: UtmData, device: DeviceInfo }` | 201 `{ user: MeResponse, tokens: TokenPair }` | `FORBIDDEN` `signup_disabled` (flag); `CONFLICT` `email_taken` (parity with web — see note); `BAD_REQUEST` `invalid_input` + zod issues; `TOO_MANY_REQUESTS` |
| `POST /v1/auth/login` | none | `{ email, password, device: DeviceInfo }` | 200 `{ user, tokens }` | `UNAUTHORIZED` `invalid_credentials` (same for unknown user / wrong password / no password; dummy compare kept); `TOO_MANY_REQUESTS` (`retryAfterSeconds`) |
| `POST /v1/auth/refresh` | refresh token in body | `{ refreshToken }` | 200 `{ tokens }` | `UNAUTHORIZED` `refresh_invalid` / `refresh_expired` / `session_revoked` / `refresh_reused` (family revoked) |
| `POST /v1/auth/logout` | bearer | `{ refreshToken? }` | 204 | idempotent; `UNAUTHORIZED` only if no principal |
| `POST /v1/auth/logout-all` | bearer | `{}` | 204 | bumps `token_version`, revokes all sessions (also kills web cookies via `ver` check) |
| `GET /v1/auth/sessions` | bearer | — | `{ sessions: [{id, deviceName, platform, lastUsedAt, isCurrent}] }` | optional, nice for "devices" screen |
| `DELETE /v1/auth/sessions/{id}` | bearer | — | 204 | `NOT_FOUND` |
| `POST /v1/auth/email-verification/send` | bearer | `{}` (email from principal, **not** body) | 202 `{ cooldownSeconds }` | `CONFLICT` `already_verified`; `TOO_MANY_REQUESTS` (`retryAfterSeconds`) |
| `POST /v1/auth/email-verification/verify` | bearer | `{ code: string(6 digits) }` | 200 `{ emailVerified: true, bonusGranted: boolean }` | `BAD_REQUEST` `invalid_code` (`attemptsLeft`); `BAD_REQUEST` `expired_code`; `TOO_MANY_REQUESTS` `too_many_attempts` (code invalidated, must resend); `CONFLICT` `already_verified` |
| `POST /v1/auth/password/forgot` | none | `{ email }` | 202 always | `TOO_MANY_REQUESTS` (per email and per IP) |
| `POST /v1/auth/password/reset` | none | `{ token, password }` | 204 | `BAD_REQUEST` `invalid_token`; `BAD_REQUEST` `weak_password`; on success revoke all sessions + bump `token_version` |
| `POST /v1/auth/password/change` | bearer | `{ currentPassword, newPassword, revokeOtherSessions?: boolean }` | 204 | `UNAUTHORIZED` `invalid_credentials`; new feature (does not exist today) |
| `GET /v1/me` | bearer or cookie | — | `MeResponse` (port of `app/api/me/route.ts`) | `UNAUTHORIZED` |

`DeviceInfo = { deviceName?: string; platform: "ios" | "android" | "web"; appVersion?: string }`.

Notes:
- Verification by principal + `userId`-scoped lookup (fixes global code lookup and adds attempt cap: e.g. 5 attempts per code, plus per-user Redis limiter). Web server action should get the same fix.
- Password-reset link for mobile: the email currently links to the web `/reset-password?token=` page; mobile can keep using the web page (simplest) or a universal/app link (UNVERIFIED platform setup). Recommend: keep web page for v1.
- `email_taken` on register keeps today's enumeration behaviour; changing it is a product decision (verified-email-first flow). Mitigate with per-IP rate limit.
- Rate limits (new): login per email (e.g. 10/15 min) + per IP; register per IP; verify per user; refresh per session. Current limiters **fail open** (`lib/rate-limit.ts:56-63,77-82`) — for login/verify consider failing closed when Redis is configured but errors (decision for the plan).
- Error codes available in oRPC common map with statuses (observed `@orpc/client/dist/index.d.mts` COMMON_ORPC_ERROR_DEFS): `BAD_REQUEST 400, UNAUTHORIZED 401, FORBIDDEN 403, NOT_FOUND 404, CONFLICT 409, UNPROCESSABLE_CONTENT 422, TOO_MANY_REQUESTS 429`, etc.

---

## 4. Carrying the principal through oRPC (verified against admin-dashboard `node_modules/@orpc/server` 1.15.7)

Observed API:
- `os.$context<U>()` sets the initial context type (`@orpc/server/dist/index.d.mts:491`).
- `.use(middleware)` on builder/procedure; middleware receives `{ context, path, procedure, signal, lastEventId, next, errors }` (`shared/server.qKsRrdxW.d.mts:93-101`); `next({ context })` merges new context (`:82-89`).
- `.errors({ CODE: { status?, message?, data?: schema } })` typed error map (`@orpc/contract .../contract.TuRtB1Ca.d.mts:38-45`); `ORPCError(code, { message, data, cause, status })` (`@orpc/client/dist/index.d.mts:111-117`).
- `.route({ method, path, operationId, summary, description, deprecated, tags, successStatus, successDescription, inputStructure, outputStructure })` (`contract.TuRtB1Ca.d.mts:66-173`); `os.$route(...)` sets initial route.
- Handler `handle(request, { prefix, context })` (`shared/server.BqadksTP.d.mts:33-36`), as used in `admin-dashboard/src/app/rpc/[[...rest]]/route.ts`.
- Plugins in 1.15.7: `CORSPlugin`, `RequestHeadersPlugin` (`reqHeaders` in context), `ResponseHeadersPlugin` (`resHeaders`), `SimpleCsrfProtectionHandlerPlugin` (header `x-csrf-token: orpc` by default, `exclude` per procedure), `StrictGetMethodPlugin`, `BatchHandlerPlugin` (`plugins/index.d.mts:41-193`).
- Admin-dashboard error mapping pattern: `callService()` maps domain errors to `ORPCError` (`admin-dashboard/src/server/orpc/errors.ts`).

Sketch (types illustrative, not final code):
```ts
type BaseContext = { request: Request; resHeaders: Headers };
type Principal = { userId: string; sessionId: string | null; via: "bearer" | "cookie" };

const base = os.$context<BaseContext>();

const withPrincipal = base.middleware(async ({ context, next }) => {
  const principal = await resolvePrincipal(context.request);
  return next({ context: { principal } });           // Principal | null
});

const authed = base.use(withPrincipal).use(async ({ context, next, errors }) => {
  if (!context.principal) throw new ORPCError("UNAUTHORIZED", { data: { reason: "no_session" } });
  return next({ context: { principal: context.principal } }); // narrowed to Principal
});

// cookie-authenticated mutations need CSRF; bearer does not
const csrfForCookie = authed.use(async ({ context, next }) => {
  if (context.principal.via === "cookie" && !hasSameOriginProof(context.request)) {
    throw new ORPCError("FORBIDDEN", { data: { reason: "csrf" } });
  }
  return next();
});
```
- Route file passes `context: { request, resHeaders }` in `handle()`; whether `OpenAPIHandler` exposes the raw `Request` other than via the route-level `context` is UNVERIFIED — passing it explicitly from the Next route handler works with the observed `handle(request, { context })` signature.
- CSRF choice: `SimpleCsrfProtectionHandlerPlugin` would also block native clients that do not send the header — use the `exclude` option or the custom middleware above that only enforces for `via:"cookie"`. Alternatively an Origin check equivalent to Next's server-action check.
- OpenAPI security scheme: declare `components.securitySchemes.bearerAuth = { type: "http", scheme: "bearer", bearerFormat: "JWT" }` in the generator base and reference per operation. Exact `OpenAPIGenerator` options are UNVERIFIED for 1.15.x — the live docs (orpc.dev) show `OpenAPIGenerator` from `@orpc/openapi` with `ZodToJsonSchemaConverter` from `@orpc/zod`, `CORSHandlerPlugin`, an `openapi()` helper and spec version default `3.2.0`, which differ from names in the installed 1.15.7 (`CORSPlugin`), so the docs may describe a newer major. **Pin the version and re-verify against installed types after `pnpm add`.**
- Zod: app is on zod 3.25; `@orpc/zod` converter compatibility with zod 3 vs `zod/v4` is UNVERIFIED.

---

## 5. Migration sequence for auth (proposal, keeps web working)

1. Fix-forward items independent of oRPC (small PRs): remove client-controlled overrides in `jwt` update trigger (`auth.ts:115-126`) and the `console.log`s; verification attempt cap + user-scoped lookup; login/register rate limits; delete dead `components/sign-out-form.tsx` and dead `/api/*` branch in `proxy.ts:87-94` (or fix the matcher intentionally).
2. Extract a `server/` auth domain: `authenticateCredentials`, `registerUser`, `issueTokenPair`, `rotateRefreshToken`, `revokeSession`, `resolvePrincipal`, `verifyEmailCode`, `requestPasswordReset`, `resetPassword` — pure services with explicit inputs (no `cookies()`/`headers()` inside), called by both the existing server actions and the new procedures.
3. Migration `0046` (tables above) + schema types.
4. oRPC `/v1/auth/*` + `/v1/me`; `resolvePrincipal` accepts bearer or cookie.
5. Move each existing `/api/*` handler (42 call sites) to `resolvePrincipal` as it is ported; `isTopupEnabled` identify via principal.
6. Payment intents return the full widget payload; web clients stop reading identity from `useSession`.
7. Later/optional: web moves to the same endpoints; NextAuth removed.

## 6. Tests to add (auth-specific)

- Unit (Vitest, `__tests__/*.test.ts`): token sign/verify (expiry, wrong `aud`, wrong secret, `ver` mismatch); refresh rotation, reuse → family revoke, grace window; `resolvePrincipal` precedence (bearer wins, invalid bearer does **not** fall back to cookie); dummy-compare path for unknown/no-password users (assert `compare` called); verification attempt cap; reset revokes sessions; register flag gate; welcome/email bonus idempotency under concurrent verify (existing pattern in `lib/billing/__tests__/grant-quiz-bonus.test.ts`).
- Procedure tests: call procedures via oRPC server-side client with a fake principal (admin-dashboard has `src/server/orpc/__tests__` as a pattern).
- Contract tests: generated OpenAPI snapshot committed; CI diff fails on breaking changes to `/v1/auth/*`.
- E2E (Playwright): web login/register still work (`tests/e2e/login.test.ts`); API-level flow register → login → refresh → logout → refresh fails, using `request` fixture with bearer.
- Replace `vi.mock("@/app/(auth)/auth")` in 3 test files with a mock of `resolvePrincipal`.

---

## UNVERIFIED claims
1. better-auth: DB-session revocation, custom bcrypt hash/verify hooks, Drizzle schema/table names, Expo package, built-in rate limiting, refresh rotation (docs page read covers only bearer header basics).
2. oRPC OpenAPI: `OpenAPIHandler`/`OpenAPIGenerator` imports, options, error serialisation over REST, security-scheme declaration, and whether live docs (which name `CORSHandlerPlugin`, `openapi()`, spec 3.2.0) match 1.15.x — `@orpc/openapi` is not installed anywhere locally.
3. `@orpc/zod` compatibility with the app's zod 3.25 vs `zod/v4`.
4. `vercel-flag-overrides` cookie encryption with `FLAGS_SECRET` (string presence in `flags` dist observed; mechanism from owner memory only).
5. Version of `jose` available transitively, and suitability of adding it directly.
6. Same-site subdomain exposure (whether other `*.gipiti` subdomains exist).
7. Mobile payments: CloudPayments native SDK availability and App Store / Google Play digital-goods payment policy implications.
8. Universal/app-link setup for password-reset links on mobile.
9. Effort estimates (inferred, not measured).
