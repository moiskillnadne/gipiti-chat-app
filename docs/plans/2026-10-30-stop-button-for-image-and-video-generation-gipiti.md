---
date: 2026-10-30
status: done
branch: feat/gipiti-81-stop-media-generation
session: 1c44be34-7faf-4c90-94be-11e3bac3169c
---

# Stop button for image and video generation (GIPITI-81)

## Context

GIPITI-81: «Возможность остановить генерацию картинок и видео». On `origin/main` GIPITI-104 already
ships a real Stop for **text** turns: per-POST `turnId`, `POST /api/chat/[id]/stop`, Redis pub/sub +
key flag (`_lib/stop-signal.ts`), `createTurnAbort()` (`_lib/turn-abort.ts`), `hooks/use-chat-stop.ts`,
`lib/messages/interrupted.ts`. Image/video turns were left out on purpose: today the Stop button shows,
but the server still generates, uploads, saves the Document, **charges** and persists `done`; locally the
card keeps spinning. Without Redis the persisted part can stay `generating` forever. Also a bug: video
with no `result.video` returns without a terminal part.

Goal: Stop on an image/video turn really aborts the gateway request, charges nothing when no result
arrived, and leaves a «Генерация остановлена» card that survives reload. Stop is available both in the
composer and on the generating card.

Research (sonnet, installed sources): `generateImage`, `experimental_generateVideo`, `streamText` all
accept `abortSignal` and `@ai-sdk/gateway` forwards it to `fetch`. The gateway has no cancel API; an
aborted job may still be billed upstream (no official statement) → we log every media stop to measure it.

Branch: `feat/gipiti-81-stop-media-generation` from `origin/main` (already created).

## Decisions

- **Reuse GIPITI-104 machinery** (`watchChatStop` for all modes). No new endpoint, no new Redis keys.
- **Billing:** stop honoured only while awaiting the provider. Aborted before a result → no upload, no
  Document, no charge, part `stopped`. Result already in hand → finish normally (upload, save, charge,
  `done`). `chargeUsageSafe` stays the only charge path.
- **Persisted invariant:** a saved `data-mediaGeneration` part is never `generating` — it becomes
  `stopped` if the turn was aborted, else `error`.
- Media turns get **no** `data-interrupted` line — the stopped card is the marker.
- Out of scope (follow-up issue): truly aborting the in-chat `generateImage` tool (GIPITI-104 defers
  the stop for it deliberately; `LATE_BILLED_TOOLS`); fees for aborted video jobs.

## Changes

### Server (agent A)

1. `lib/types.ts` — `mediaGeneration.status` adds `"stopped"`.
2. `lib/messages/interrupted.ts` — add:
   - `finalizeMediaGenerationParts(message, status: "stopped" | "error"): ChatMessage` — rewrites
     still-`generating` `data-mediaGeneration` parts; returns the same reference when nothing changed.
   - `markLastAssistantStopped(messages): ChatMessage[]` — last assistant has a `data-mediaGeneration`
     part → finalize as `stopped`; otherwise → existing `finalizeInterruptedMessage`; trailing non-assistant
     → same ref. Decide by message content, not the selected model.
3. `_lib/image/types.ts` — `ImageGenInput.abortSignal: AbortSignal`.
4. `_lib/image/providers.ts` — pass `abortSignal` to every `sdkGenerateImage`, the multimodal
   `streamText`, `generateRecraftImage`, `fetchImageBytes(url, signal)`. In `runImageEdit` rethrow without
   the text-to-image fallback when `signal.aborted` (else Stop starts a second generation).
5. `lib/ai/recraft-client.ts` — optional `abortSignal` forwarded to `generateImage`.
6. `_lib/media-part.ts` (new, small) — `writeMediaPart(writer, base, status, extra?)` shared by both
   handlers for the repeated `data-mediaGeneration` writes.
7. `_lib/handlers/image-generation.ts` — pass `ctx.turnAbort.signal`; at the top of `catch`, if
   `ctx.turnAbort.signal.aborted`: write `stopped`, `ctx.turnOutcome = "aborted"`,
   `console.info("[media-stop]", { chatId, modelId, mediaType, elapsedMs })`, return (no save/charge).
   Set `turnOutcome = "completed"` on other terminal paths. No signal check after the provider resolves.
8. `_lib/handlers/video-generation.ts` — same as image (clear keep-alive first); replace
   `if (!videoUrl) return;` with an `error` part.
9. `app/(chat)/api/chat/route.ts` — start `watchChatStop` for every mode (keep immediate
   `turnSettlement.resolve()` for non-text); pre-abort skip for every mode; `aborted` for non-text =
   `ctx.turnOutcome === "aborted" || (turnAbort.requestedAt !== undefined && ctx.turnOutcome !== "completed")`.
   Update comments.
10. `_lib/persist-assistant-turn.ts` — superseded check whenever `aborted`; non-text assistant messages
    → `finalizeMediaGenerationParts(message, aborted ? "stopped" : "error")`. Update JSDoc and the
    `turnOutcome` doc in `_lib/context.ts`.

### Client (agent B, codes against the signatures above)

11. `components/chat.tsx` — `onFinish`: `if (isAbort) setMessages(markLastAssistantStopped)`; drop the
    model-type guard and unused imports; pass `onStop={handleStop}` to `<Messages>`.
12. `components/messages.tsx`, `components/message.tsx` — thread `onStop` (+ memo comparators). On the
    `data-mediaGeneration` branch pass `onStop` only when `!isReadonly && isLoading && status === "generating"`;
    map `stopped` to `MediaPreview`.
13. `components/elements/media-preview.tsx` (already >200 lines — keep edits minimal):
    `MediaPreviewState` adds `"stopped"`, prop `onStop?`; `GeneratingCard` renders `MediaStopButton`;
    `stopped` → `MediaStoppedCard`. New files: `media-stop-button.tsx`, `media-stopped-card.tsx`
    (neutral card, icon, title, subtitle, «Повторить» when `onRegenerate`), `media-preview-styles.ts`
    (shared `CARD_FRAME*`, `MEDIA_AREA`, `FROSTED`, `CardShape`).
14. `components/elements/document-preview.tsx` — `state: Exclude<MediaPreviewState, "stopped">`.
15. `messages/ru.json` → `chat.media`: `stop` «Остановить», `stopGeneration` «Остановить генерацию»,
    `stoppedTitle` «Генерация остановлена», `stoppedImage` «Изображение не создано»,
    `stoppedVideo` «Видео не создано». No billing wording.

### Tests (Vitest, AAA)

- `lib/messages/__tests__/interrupted.test.ts` — extend for both new helpers.
- `_lib/__tests__/image-generation-stop.test.ts` — signal forwarded; reject after `requestAbort()` →
  `stopped`, no save/charge, `turnOutcome === "aborted"`; resolve then stop → `done`, charged;
  non-abort error → `error`.
- `_lib/__tests__/video-generation-stop.test.ts` — abort → `stopped`, no charge, no keep-alive writes
  after stop (fake timers); missing video → `error`.
- `_lib/__tests__/image-providers-abort.test.ts` — dedicated adapter sees the signal; aborted edit does
  not fall back (one `doGenerate`).
- `_lib/__tests__/persist-assistant-turn.test.ts` — aborted media → `stopped`; dangling generating →
  `error`; text unchanged.

## Order of work (multi-agent)

1. Agents A (server + tests) and B (client) run in parallel on disjoint files — `sonnet`.
2. `pnpm check` by me; fix loop through the owning agent.
3. Code review — `opus` (review agent) on `git diff origin/main`; fixes by `sonnet`; re-check.
4. Browser QA, then commit (conventional commits) on my go.

## Risks

- Gateway may bill aborted jobs (video worst case) → `[media-stop]` logs + dashboard check; product follow-up.
- Race: result arrives as Stop is pressed → client shows stopped, server charges and saves; asset visible
  after reload. Accepted (user-favour only where no result).
- Abort reason must stay `DOMException("…","AbortError")` (`turnAbort` guarantees it).
- `MediaPreviewState` ripple into `DocumentPreview`.
- Components over 200 lines — new UI goes to new files.

## Verification

- `pnpm check:fast` while iterating, final `pnpm check` (typecheck, Biome, unit tests, build).
- `pnpm dev` + browser pane: image model (dedicated + Gemini multimodal) and a video model; Stop from
  the card and the composer at early / mid generation; `POST /api/chat/:id/stop` → 204, `[media-stop]` in
  logs, no `Transaction`/`Document` for the turn, reload shows the stopped card (no spinner, no resume),
  «Повторить» works, text Stop (GIPITI-104) unchanged. Real generations cost money and need a
  funded test account — if not available locally, rely on unit tests and say so.

## Implementation notes (departures from the plan)

- Handlers count a stop as "stopped" only while the provider call is pending (`isProviderResolved`),
  so a post-result failure (e.g. upload) is still reported as `error`.
- `ImageGenInput.abortSignal` is required, not optional.
- Multimodal (Gemini) adapter: the result counts as "in hand" only after `finish-step` (`hasFinishedStep`).
  `streamText` drops the chunk read after an abort, so a Stop between `file` and `finish-step` would
  otherwise deliver the image at $0. The image handler now warns on a delivered $0 cost, like video.
- No-Redis cancel path: `onFinish` runs while a media handler may still be saving and charging.
  The route resolves `handlerDone` in a `finally` around the handler and waits for it until the function
  deadline minus `MEDIA_PERSIST_MARGIN_MS` (`mediaPersistWaitMs`). It also adds `after(() => handlerDone)`.
  The handler's last card is kept on `ctx.finalMediaPart` (`createMediaPartWriter` in `_lib/media-part.ts`)
  and `persistAssistantTurn` puts it back, with its `file` part, before `finalizeMediaGenerationParts`.
- The `aborted` formula moved into the pure `isTurnAborted` (`_lib/turn-lifecycle.ts`), unit-tested.
- `writeMediaPart` became the `createMediaPartWriter(ctx, writer, base)` factory (Biome `useMaxParams`).
  `MEDIA_FILE_TYPES` is shared by both handlers.
