---
date: 2026-10-03
status: done
branch: claude/client-crash-chat-removechild-b7e2b8
session: e09a35d4-de00-4f0a-a034-054ac91bf2af
---

# Fix chat removeChild crash (GIPITI-101)

## Context

On 2026-10-03, one production user hit the route error boundary 3 times in about 1.5 minutes:
`Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.`

What the Vercel runtime logs show:
- Crashes #1 and #2 happened **in the same second as the stream-finish refetch**. `GET /api/history` and `GET /api/usage` (fired from `onFinish` in `components/chat.tsx`) and `POST /api/log` all land at 10:29:37 and 10:30:03. So the crash happens when the finished assistant message re-renders.
- No `/api/files/upload` requests in the window, so no attachment was sent. The 10:29:07 stream did **not** crash, but every stream after the first reload did.
- There are only 3 events in 48h, all from one user. Before that day there were none.
- The deployment skew is real: pages came from `dpl_CHJE…` (#237) and APIs from `dpl_47rg…` (#238). But #237 and #238 differ only in `.claude/` and scripts, so both builds run identical app code. Skew is not the cause.
- I reviewed the diffs of #232 (lightbox) and #235 (attachment cards). They contain no external DOM mutation, no invalid nesting (`DocumentCard` is valid) and no portal on the finish path. React code alone does not produce this error.

The best-fitting cause is a **page translator** (Chrome/Yandex Translate, or a similar extension). It swaps React's text nodes for `<font>` wrappers. React then calls `removeChild` on a node that is no longer there, which is facebook/react#11538. The timeline fits: the first stream ran before the user turned translation on, and every stream after the reload crashed because "always translate" stays on.

Chosen approach: **better diagnostics plus a DOM guard**, so a translator can no longer crash the route and translation keeps working.

## Order of work

### 0. Reproduce first (before any fix)
- Copy `.env.local` from the main checkout into the worktree and start the `dev` preview.
- In the browser pane, use `javascript_tool` to inject a translator simulation: a `MutationObserver` that wraps every new or changed text node under `main` in a `<font>`, the way Google Translate does.
- Send a message and wait for the stream to finish. Confirm the route error boundary shows the same `removeChild` message.
- If it does **not** reproduce, stop and report back before going further. That would point to a code bug, and the guard would only hide it.

### 1. Richer client diagnostics
- **New `lib/client-diagnostics.ts`**: a pure `getClientDiagnostics()` that returns a `ClientDiagnostics` type with:
  - `userAgent` and `language`
  - `buildId` from `process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`; confirm Vercel exposes it, otherwise fall back to `NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID`
  - `isPageTranslated`: the `<html>` class contains `translated-`, or `document.querySelector("font")` exists, since the app never renders `<font>`
  - the `<html lang>` value as the user's browser sees it
- **`components/route-error-fallback.tsx`** and **`app/global-error.tsx`**: spread the diagnostics into the existing `clientLog.error` context, plus `stack: error.stack` truncated to about 1,500 chars.
- **`components/error-logger.tsx`**: add the same diagnostics to the `error` and `unhandledrejection` reports.
- **`app/api/log/route.ts`**:
  - Validate the body with zod: `level` must be `"error"` or `"info"`, `message` is a string capped in length, `context` is unknown.
  - Return 400 on bad input instead of crashing on `level.toUpperCase()`.
  - Also log the server-side `user-agent` header and `x-vercel-id`, which can be trusted even when the client payload is missing.
  - Wrap everything in try/catch.

### 2. DOM mutation guard
- **New `lib/dom/dom-mutation-guard.ts`**:
  - Pure factories `createSafeRemoveChild(original, onMismatch)` and `createSafeInsertBefore(original, onMismatch)`.
  - If `child.parentNode !== this` (or `reference.parentNode !== this`), they report the mismatch and skip the call (removeChild returns the child; insertBefore appends instead), rather than throwing.
  - `installDomMutationGuard(onMismatch)` patches `Node.prototype` once, behind an idempotency flag, and only when `typeof Node !== "undefined"`.
  - Add JSDoc that links facebook/react#11538 and explains why the patch exists.
- **New `components/dom-mutation-guard.tsx`** (client): calls `installDomMutationGuard` at **module evaluation**, so the patch is in place before hydration, and renders `null`.
  - `onMismatch` sends `clientLog.info("DOM mutation guard prevented crash", { operation, ...getClientDiagnostics() })` **once per page load**. That gives telemetry on how often translators interfere, without spamming.
- **`app/layout.tsx`**: render `<DomMutationGuard />` next to `<ErrorLogger />`.

### 3. Tests
- **`lib/dom/__tests__/dom-mutation-guard.test.ts`**. Vitest runs in the node environment, so use plain fake node objects.
  - When the child belongs to the parent, the original is called and its value returned.
  - When it doesn't, the original is skipped, `onMismatch` is called once and the child is returned.
  - `insertBefore` with a foreign reference node falls back to append.
  - `install` is idempotent.
- **`lib/__tests__/client-diagnostics.test.ts`**: the `isPageTranslated` detection, with `document` stubbed.

### 4. Plan file and docs
- Save this plan to `docs/plans/` (the hook does this on approval) and set `status: done` when finished.
- Add one line to CLAUDE.md "Common Gotchas" about the guard, so nobody removes it as dead code.

## Files

| File | Change |
|---|---|
| `lib/client-diagnostics.ts` | new |
| `lib/dom/dom-mutation-guard.ts` | new |
| `components/dom-mutation-guard.tsx` | new |
| `app/layout.tsx` | mount the guard |
| `components/route-error-fallback.tsx`, `app/global-error.tsx`, `components/error-logger.tsx` | add diagnostics |
| `app/api/log/route.ts` | zod validation, UA and request id |
| `lib/dom/__tests__/…`, `lib/__tests__/…` | tests |
| `CLAUDE.md` | gotcha line |

## Risks
- **The guard can hide real bugs.** It only skips calls that would have thrown anyway, and it reports them through `clientLog.info`, so nothing fails silently. Step 0 checks that the crash really comes from a translator before the guard goes in.
- **A translated page can show stale text.** The UI stays usable, but React's later text updates may land on detached nodes, so the translated view of a streamed message may not refresh. That's acceptable compared with a crashed route, and translators already behave this way.
- **Build id env var name.** Check that it is actually populated on Vercel. Locally it will be `undefined`, which is fine.
- **Skew Protection** is not the cause here, but the logs show skew windows do happen. Mention to the user that it can be turned on in the Vercel dashboard. No code change.

## Verification
1. Step 0 repro, before the fix: the crash happens.
2. After the fix, the same `<font>`-wrapping simulation:
   - the stream finishes with no error boundary
   - `preview_logs` shows one `DOM mutation guard prevented crash` line with `isPageTranslated: true`
3. Without the simulation, normal chat works (send, stream, finish, regenerate, attachment card, lightbox open) and the guard logs nothing.
4. Force a boundary error, e.g. a temporary throw. The `/api/log` line includes UA, language, buildId and stack.
5. Run `pnpm check`: typecheck, lint, unit tests and build all green.

## Outcome

- **Reproduced (step 0).** With a `<font>`-wrapping translator simulation on a dev chat, a short plain answer and a markdown-heavy one did **not** crash. A **web-search** answer crashed with the exact production error, thrown while React deleted a `<span>`.
- **Root cause.** The `ToolRunRenderer` header title changes from `[text "Исследую", <em>…</em>]` while streaming to a single string when the stream finishes. React deletes the bare text node, but the translator has already replaced it. The prod cost of $0.0044 per request fits a search-billed answer. The code is older than #232 and #235; this user was the first to use a translator together with web search.
- **Departure from the plan.** Added a targeted fix in `components/tool-run-renderer.tsx`: each title variant is now its own keyed `<span>`, so the swap replaces an element instead of removing text nodes. The diagnostics test lives in `lib/__tests__/client-diagnostics.test.ts`.
- **Verified.**
  - With the title fix and the simulation: no crash, and the guard did not need to fire.
  - With the title fix reverted, the guard alone prevented the crash and logged one `DOM mutation guard prevented crash` line with `isPageTranslated: true`.
  - Without the simulation: normal chat works, the guard stays silent, and a thrown error reports stack, UA, language and the translated flag.
