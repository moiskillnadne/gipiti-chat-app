---
date: 2026-11-01
status: done
branch: fix/chat-input-update-depth
---

# Chat input drops characters on input bursts (React #185)

## Goal

Stop `Maximum update depth exceeded` (minified React error #185) in the chat composer. Production
logged it on `/chat` (iPhone, Yandex Browser, 2026-10-20). Reproduced: 120 `input` events in one task
(dictation, text expanders, automation typing) keep 118 characters and throw #185 twice.

## Cause

`components/multimodal-input.tsx` mirrored every keystroke into `useSessionStorage` (usehooks-ts)
from an effect. That hook keeps the value in React state and re-reads it on its own
`session-storage` event, so each keystroke caused two extra synchronous updates from a passive
effect. React counts those as nested updates; a burst in one task passes the limit of 50 and the
keystroke that crosses it is lost.

## Change

- `lib/chat/input-draft.ts`: `readInputDraft` / `writeInputDraft` -- plain sessionStorage access,
  same `input-${chatId}` key and JSON encoding as before (old drafts still restore), errors swallowed
  (quota, blocked storage).
- `components/multimodal-input.tsx`: drop `useSessionStorage`; restore the draft on mount and on
  chat switch with `readInputDraft`, save it from an effect with `writeInputDraft` (no state update).
  Submitting clears the draft through the same effect (`input` becomes "").

## Risks

- Effect order: the restore effect must run before the save effect, or the current input would
  overwrite the draft of the chat being opened. Both live in the same component, restore first.
- `/chat` mints a new chat id per load, so drafts there never survived a reload -- unchanged.

## Verification

- `lib/chat/__tests__/input-draft.test.ts` (unit): round trip, per-chat keys, clearing, legacy JSON
  format, storage errors, server rendering.
- `tests/e2e/chat-input.test.ts` (Playwright): 120 input events in one task keep every character
  with no page error (fails before the fix with 118/120 and two #185 errors); draft survives a
  reload of `/chat/[id]`; drafts stay per chat.
- `pnpm check`, full Playwright suite.
