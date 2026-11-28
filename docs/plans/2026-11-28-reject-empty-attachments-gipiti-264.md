---
date: 2026-11-28
status: in-progress
branch: fix/gipiti-264-empty-attachment
issue: GIPITI-264
---

# Reject empty attachments and stop logging an empty .docx as an error

## Goal

On 2026-11-23 a user attached a 0-byte .docx (probably a cloud-drive file not yet
downloaded to the device). The upload stored it, and every later turn of the chat
logged `Failed to extract DOCX … Corrupted zip ?` with a full stack, while the model
got "could not read the file". The upload should refuse an empty file with a clear
message, and a stored empty .docx should not produce an error log on every turn.

## Files

- `app/(chat)/api/files/upload/route.ts`: a new `empty_file` code, answered 400 before
  the type check when `file.size === 0`.
- `components/multimodal-input.tsx`: map `empty_file` to its own message.
- `messages/ru.json`: `chat.input.uploadEmpty`.
- `lib/ai/docx-extract.ts`: an empty download becomes the note «файл пустой» for the
  model and a one-line `console.warn`, not `console.error` with a stack.
- Tests: `app/(chat)/api/files/upload/__tests__/route.test.ts` (new),
  `lib/ai/__tests__/docx-extract.test.ts`.

## Order

1. Upload route + test. 2. Composer mapping + string. 3. Extraction + test. 4. `pnpm check`.

## Risks

- An empty text file (.txt/.md) is now refused too. It carried nothing for the model,
  so nothing is lost.
- Already stored empty attachments stay in old chats; step 3 covers them.

## Verification

`pnpm check` (typecheck, Biome, unit tests, build).
