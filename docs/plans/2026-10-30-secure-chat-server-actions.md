---
date: 2026-10-30
status: done
branch: claude/zealous-cori-5q948l
---

# Secure chat server actions (IDOR in deleteTrailingMessages)

## Goal

Every export of a `"use server"` file is a public endpoint. Two exports in
`app/(chat)/actions.ts` were open to any caller:

1. `deleteTrailingMessages({ id })` — no `auth()` and no ownership check. Anyone
   who knows a message id could delete messages in another user's chat (IDOR).
2. `generateTitleFromUserMessage({ message })` — no `auth()`. Anyone could call
   the title model with any prompt at our cost. It is only used on the server
   (`prepare-chat-turn.ts`), so it should not be a server action at all.

The other actions in `app/(chat)/actions.ts` only set cookies on the caller's
own browser (the `chat-project` cookie is checked for ownership in
`prepare-chat-turn.ts` before use). `app/(auth)/actions.ts` holds the public
auth forms (login, register, verify, reset), which must work without a session.

## Files that change

- `lib/chat/delete-trailing-messages.ts` (new) — `deleteTrailingMessagesForUser`:
  load message → missing: return; load chat → missing: `not_found:chat`;
  `chat.userId !== userId`: `forbidden:chat`; then delete.
- `lib/chat/__tests__/delete-trailing-messages.test.ts` (new) — unit tests.
- `lib/ai/generate-chat-title.ts` (new) — `generateTitleFromUserMessage` moved
  here (plain server module, not a server action).
- `app/(chat)/actions.ts` — `deleteTrailingMessages` calls `auth()`
  (`unauthorized:chat`), validates the id is a UUID (`bad_request:chat`), then
  calls the lib function; title function removed.
- `app/(chat)/api/chat/_lib/prepare-chat-turn.ts` — import the title function
  from `lib/ai`.
- `components/message-editor.tsx` — catch a failed delete: show the
  `common.toasts.actionFailed` toast, keep the editor open, do not regenerate.

## Order of work

1. lib function + tests. 2. Action + title move. 3. Client error handling.
4. `pnpm check`.

## Risks

- Next.js hides server-action error messages in production, so the client
  cannot read the error code. That is fine: the editor shows one generic toast.
- A message that is not saved yet (missing) returns quietly, same as the old
  "nothing to delete" path, so editing still works.

## Verification

- `pnpm vitest run lib/chat/__tests__/delete-trailing-messages.test.ts`
- `pnpm check`
