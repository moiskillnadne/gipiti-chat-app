---
date: 2026-11-01
status: in-progress
branch: fix/chat-max-duration-800
---

# Raise chat route max duration to 800s and log turn timing

## Goal

On 2026-10-28 one user lost 7 chat turns: `POST /api/chat` ran into the 300s
Vercel limit (`Task timed out after 300 seconds`) and was killed. The answer was
not persisted, the gateway cost was not charged, and the resume requests
(`GET /api/chat/[id]/stream`) hung for 300s each. The logs only show the session
callback, so it is unknown which model hung and whether it was slow reasoning or
a silent stream.

1. Give long answers (reasoning models) room to finish instead of cutting them:
   raise `maxDuration` of the chat route and its resume route from 300s to 800s
   (the GA maximum for Pro with Fluid compute; the project-level default stays
   300s for every other function).
2. Make the next timeout diagnosable: log the start and end of every turn with
   chat, turn, model and mode, and warn when a turn is still running shortly
   before the function deadline.

Out of scope: a forced deadline abort (rejected: it cuts reasoning), the 1800s
extended beta, moving the chat turn to Vercel Workflow, re-enabling the 10s Wan
clip.

## Files

- `app/(chat)/api/chat/route.ts`: `maxDuration = 800`; turn diagnostics wired
  in; the stop watcher lifetime derived from `maxDuration`.
- `app/(chat)/api/chat/[id]/stream/route.ts`: `maxDuration = 800` so a resumed
  stream can follow a producer for its whole lifetime.
- `app/(chat)/api/chat/_lib/stop-signal.ts`: default watcher lifetime comment
  and value no longer claim 300s.
- `app/(chat)/api/chat/_lib/turn-diagnostics.ts` (new): start/end logs and the
  near-deadline warning timer.
- `app/(chat)/api/chat/_lib/__tests__/turn-diagnostics.test.ts` (new).
- `lib/ai/models.ts`, `lib/ai/__tests__/model-registry.test.ts`: comments that
  cite the 300s limit.
- `CLAUDE.md`, `.claude/agents/review.md`: 300s -> 800s.

## Order of work

1. Raise both route durations; derive the stop watcher lifetime from it.
2. Add the diagnostics helper with tests, wire it into the POST route.
3. Update comments and docs that cite 300s.
4. `pnpm check`.

## Risks

- If the team is on Hobby, a deployment with `maxDuration = 800` fails to
  build. The dashboard shows the Pro-only "Longer Functions" note; a preview
  deployment confirms it before production.
- Longer turns hold a function instance longer. Fluid compute bills active CPU,
  and waiting on the gateway stream uses little; provisioned memory is billed
  for the extra time.
- A silent (hung) stream now waits up to ~800s instead of 300s before the
  function dies. The new logs show whether that happens; an idle-chunk timeout
  can be added once there is data.
- Derived timings scale with `maxDuration`: the forced-stop deadline
  (`DEADLINE_MARGIN_MS`) and the media persist wait (`mediaPersistWaitMs`)
  already read it, so they follow automatically.

## Verification

- `pnpm check` (typecheck, lint, unit tests, build).
- New unit tests: the warning fires once at `maxDuration - margin`, never after
  the turn ended; the end log carries the duration and outcome.
- After deploy: runtime logs show `[chat-turn] start` / `[chat-turn] end` lines;
  a preview deployment builds with `maxDuration = 800`.
