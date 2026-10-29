---
date: 2026-10-29
status: accepted
branch: claude/eager-carson-nk9euo
session: 346530ac-52f5-538e-8761-7b03c0357740
---

# Add October 2026 models and fix broken gateway ids

## Context

The Vercel AI Gateway changed under us: `xai/grok-imagine-video-1.5-preview` now returns 404 (Grok video is broken in prod), `perplexity/sonar-pro` and `perplexity/sonar-reasoning-pro` are silently served as plain Sonar, and xAI moved to the `spacexai/*` namespace (old `xai/*` ids are only aliases). At the same time 12 new chat models, 4 new image models and 1 new video model with known prices appeared. Goal: fix the broken/misleading entries, add the priced models to the picker, and give every new model a Russian SEO landing.

Decisions taken with the user:
- Data source: the user's table (ids, prices, dates). `ai-gateway.vercel.sh` and `vercel.com` are blocked in this sandbox; research agents cross-check through WebSearch (it indexes `vercel.com/ai-gateway/models/*`). The user re-checks with `pnpm models:list` before merge.
- Models without a gateway price (FLUX 3 Klein, Recraft v4.1 Flash, Grok Video 1.5 Lite, Wan v3.0 Prime, MiniMax H3 Max, Veo 3.1 Lite, Seedance 2.0 Mini, Kling v3.0 Motion Control) are **skipped**: media is billed from gateway `cost`, so $0 means free generation.
- Sonar Pro / Sonar Reasoning Pro: **hidden** (`showInUI: false`), landings + catalog cards removed, 301 redirects to `/models/perplexity-sonar`.
- Qwen 3.7 Flash **stays**, Qwen 3.8 Flash added next to it (3.7 marked previous generation).
- Image landings: copy is written now into a draft doc with render prompts; landings + catalog cards for image models are wired later, after real renders exist (`model-landings.test.ts` requires real renders by that model).

## Scope

**Fixes**
1. `grok-imagine-video` → `spacexai/grok-imagine-video-1.5`; `buildVideoProviderOptions` prefix check accepts `spacexai/`.
2. Hide `sonar-pro`, `sonar-reasoning-pro` (registry entries + providers stay so old chats/cookies still resolve).
3. `xai/*` → `spacexai/*` for grok-4.3/4.5/4.6 and grok-imagine-image/-2.0 (update the "alias" comment in `models.ts`).
4. Add `qwen3.8-flash` (`alibaba/qwen3.8-flash`).

**New chat models** (app id → gateway id): `gemini-4-argon`, `gpt-6.1-terra`, `kimi-k3.1-pro`, `muse-wonder-1.0` (meta), `muse-spark-1.3` (meta), `qwen3.8-max-prime`, `qwen3.8-flash`, `deepseek-v4.1-flash-1017`, `mistral-large-4` (mistral), `glm-5.3` (zai), `minimax-m3.1-flash` (minimax), `mimo-v2.6-pro` (xiaomi).

**New image models**: `nano-banana-2.1` (`google/gemini-nano-banana-2.1`), `flux-3-image`, `mai-image-2.6`, `mai-image-2.6-flash` (microsoft).

**New video model**: `wan-v3.0-video` (`alibaba/wan-v3.0-video`).

New `ModelProvider` values: `meta`, `mistral`, `zai`, `minimax`, `xiaomi`, `microsoft` — each needs a monogram logo SVG (same style as `components/icons/logos/moonshotai.svg`) and entries in every provider map.

## Files that change

- `lib/ai/models.ts` — entries, `ModelProvider`, `openaiModelIds`/`googleModelIds`, `DEDICATED_IMAGE_GATEWAY_MAP`, Wan video sections, spacexai ids
- `lib/ai/providers.ts` — gateway mappings (OpenAI wrapped with `<think>` middleware as siblings; MiniMax wrapped too, since MiniMax emits `<think>` tags in text — no-op if absent)
- `lib/ai/entitlements.ts`, `messages/ru.json` (names/descriptions; Sonar Pro hidden)
- `app/(chat)/api/chat/_lib/handlers/video-generation.ts` — spacexai prefix
- `app/(chat)/api/chat/_lib/image/providers.ts` — only if a new image model needs its own adapter
- Provider maps: `components/icons/logos.tsx` + `logos/*.svg`, `components/assistant-icon.tsx`, `components/model-badge.tsx`, `components/ui/model-selector/use-model-selector.ts`, `lib/prompts/prompt-meta.ts`, `lib/ai/model-capability.ts` (code pattern)
- `lib/ai/__tests__/model-registry.test.ts` — new ids in the new-model checks
- Landings: `lib/marketing/model-landings/{shared,index,google,openai,moonshotai,alibaba,deepseek,perplexity,video-xai}.ts`, new `meta.ts`, `mistral.ts`, `zai.ts`, `minimax.ts`, `xiaomi.ts`, `video-alibaba.ts`; `lib/marketing/models-catalog.ts`; `lib/marketing/landing-content.ts` (provider count/list); `next.config.ts` (Sonar redirects)
- `docs/model-landing-drafts/2026-10-image-models.md` — image landing copy + render prompts

## Order of work (multi-agent workflow)

Orchestrator: Opus (main loop). Coders: Sonnet. Research, content/SEO, review: Opus.

1. **Verify** (Opus ×2, parallel) — WebSearch each id on `vercel.com/ai-gateway/models/*` and vendor pages: gateway type (language/image/video), price, context, vision/PDF/reasoning/tools, video params. Output a facts table; unknowns marked `unverified`.
2. **Build** (parallel)
   - Registry coder (Sonnet) — all code wiring above. Unverified capability → conservative default (no attachments, no thinking picker, no media settings that might be placebo).
   - Content writers (Opus ×3: OpenAI/Google/Moonshot/Alibaba/DeepSeek; Meta/Mistral/Z.ai/MiniMax/Xiaomi; media) — Russian landing copy + catalog card as JSON in the scratchpad, matching `lib/marketing/model-landings/types.ts`; claims only from the facts table.
3. **Landings** (Sonnet) — turn JSON into landing modules, slugs, catalog cards, Sonar removal + redirects, image draft doc.
4. **Review** (Opus ×2, parallel) — code/billing/conventions review (repo `review` agent) and content/SEO review.
5. **Fix** (Sonnet) — apply confirmed findings, run full `pnpm check`.
6. Orchestrator re-runs `pnpm check`, reads the diff, commits, pushes to `claude/eager-carson-nk9euo`.

## Risks

- **No live gateway check.** Ids, model type (e.g. Nano Banana 2.1 as language vs image model) and params come from the table + search. The user runs `pnpm models:list` before merge.
- **Text billing uses TokenLens (models.dev).** New vendors (Meta, Mistral, Z.ai, MiniMax, Xiaomi) may be missing there → $0 charge + `[ALARM-USAGE]`. Same mechanism as every model today; check first prod charges. A gateway-`cost` fallback is a separate follow-up.
- **spacexai switch** changes the TokenLens lookup id for grok-4.3/4.5/4.6 (grok-4.7 already uses it and prices correctly).
- **Grok video providerOptions namespace** under `spacexai/` is unverified — resolution may be ignored; verify a 720p clip after deploy.
- MiniMax `<think>` handling and capability flags of new vendors are unverified.

## Verification

- `pnpm check` (typecheck, Biome, unit tests incl. `model-registry.test.ts`, `model-landings.test.ts`, build).
- After deploy: one message per new chat model → non-zero `Transaction`; one Grok video and one Wan video; one image per new image model; open each new `/models/<slug>`; `/models/perplexity-sonar-pro` returns 301.
