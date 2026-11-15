---
date: 2026-11-15
status: done
branch: fix/gipiti-153-quiz-bonus-requires-verified-email
issue: GIPITI-153
---

# Quiz bonus requires a verified email (GIPITI-153)

## Goal

`lib/billing/constants.ts` states the rule: the welcome grant is the only onboarding grant paid
before the email is confirmed. The quiz bonus must follow it on the server, not only in the UI.
Details are in GIPITI-153.

- `grantQuizBonus` reads `User.emailVerified` from the database and refuses to credit an
  unverified user by throwing a domain error (`EmailNotVerifiedError`). Every quiz in
  `lib/quiz/registry.ts` goes through it, so present and future quizzes are covered.
- `POST /api/quiz/[key]` checks the same database flag before it saves anything and answers 403
  (`forbidden:auth`) with a localized Russian message. No answers are saved and no `Transaction`
  row is written, so the user can complete the quiz after confirming the email.
- Idempotency (one `quiz_bonus` per user per quiz key) is unchanged.

No schema change, no migration.

## Files

- `lib/billing/email-verification.ts` (new): `EmailNotVerifiedError`, `isUserEmailVerified`
  (DB read by user id) and `assertEmailVerified`. A separate module keeps the edit to
  `balance.ts` to one line, since another branch edits that file in parallel.
- `lib/billing/balance.ts`: `grantQuizBonus` calls `assertEmailVerified` before any write;
  JSDoc updated.
- `app/(chat)/api/quiz/[key]/route.ts`: verification check after input validation and before the
  completion lookup, the save and the grant.
- `messages/ru.json`: `onboardingQuiz.api.emailNotVerified`.
- Tests (new): `lib/billing/__tests__/grant-quiz-bonus.test.ts`,
  `app/(chat)/api/quiz/[key]/__tests__/route.test.ts`.

Client: the quiz banner on `/subscription` is rendered only when the session says the email is
verified, so an unverified user does not reach the quiz UI in the normal flow. The UI is left as
it is.

## Order of work

1. Write both test files and see them fail on the current code.
2. Add the helper module and the check in `grantQuizBonus`.
3. Add the check and the 403 in the route, plus the message key.
4. Lint, typecheck, unit tests, build.

## Risks

- A parallel branch edits `lib/billing/balance.ts` (GIPITI-122). The change there is a single
  call plus a JSDoc line inside `grantQuizBonus`, so a conflict is unlikely and trivial.
- Users who completed the quiz before confirming the email keep what they have; this change does
  not touch existing rows.

## Verification

- `pnpm lint`, `pnpm typecheck`
- `pnpm vitest run --exclude ".claude/**"`
- `pnpm exec next build`
