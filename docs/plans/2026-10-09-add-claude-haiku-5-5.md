---
date: 2026-10-09
status: done
branch: claude/haiku-5.5-service-integration-9gm7su
---

# Add Claude Haiku 5.5

## Goal

Make Anthropic's new Claude Haiku 5.5 (`anthropic/claude-haiku-5.5` on the AI Gateway) available in the chat model picker, and give it a public landing page and a `/models` catalog card. Haiku 4.5 stays available.

Model facts: 1M context, adaptive thinking on by default, effort `low`–`max` (default `medium`), images and PDFs supported. Price $0.10 / $0.50 per 1M tokens for prompts up to 100K tokens ($0.50 / $2.50 above).

## Files that change

- `lib/ai/models.ts` — `haiku-5.5` registry entry (reasoning + attachments, `OPUS_THINKING_CONFIG`: auto/low/medium/high, "auto" omits effort so the API default applies) and `anthropicModelIds`
- `lib/ai/providers.ts` — gateway mapping `anthropic/claude-haiku-5.5` (native reasoning, no `<think>` middleware)
- `lib/ai/entitlements.ts` — visible in the picker
- `messages/ru.json` — `haiku55` name/description; Haiku 4.5 marked as previous generation
- `lib/ai/__tests__/model-registry.test.ts` — add `haiku-5.5` to the new-model checks
- `lib/marketing/model-landings/shared.ts` — `HAIKU_55_SLUG = "claude-haiku-5-5"`
- `lib/marketing/model-landings/anthropic.ts` — Haiku 5.5 landing
- `lib/marketing/models-catalog.ts` — catalog card (every catalog model needs a landing)

## Order of work

1. Registry, provider, entitlements, i18n, tests.
2. Landing slug, landing copy, catalog card.

## Risks

- Billing uses the live TokenLens (models.dev) catalog. If models.dev does not list Haiku 5.5 yet, the charge is $0 and `[ALARM-USAGE]` is logged. Same mechanism as every other model; check the first production charge.
- Gateway id is assumed to follow the existing pattern (`anthropic/claude-haiku-5.5`); `pnpm models:list` confirms it (not reachable from the cloud sandbox).

## Verification

- `pnpm check` (typecheck, Biome, unit tests incl. `model-registry.test.ts` and `model-landings.test.ts`, build).
- After deploy: send a message with Haiku 5.5, confirm a non-zero `Transaction` charge; open `/models/claude-haiku-5-5`.
