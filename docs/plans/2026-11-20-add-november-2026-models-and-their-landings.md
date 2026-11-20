---
date: 2026-11-20
status: done
branch: feat/november-2026-models
session: ec844b85-974f-4358-9ae7-2d070129ea9b
---

# Add November 2026 models and their landings

## Context

The AI Gateway catalog (`https://ai-gateway.vercel.sh/v1/models`, fetched 2026-11-20, 518 models)
has 17 priced models from providers GIPITI already serves that are not in the registry. The goal
is to add them to the model picker, give each a Russian SEO landing under `/models/{slug}`, and
ship real renders for the image landings. This repeats the October pass
(`docs/plans/2026-10-29-add-october-2026-models-and-fix-broken-gateway-ids.md`, commits `afc1f7d`,
`721a7b4`, `85c0626`), which is the template for wiring, copy and renders.

Decisions taken with the owner:
- Scope is the 14 new models plus the 3 that October skipped for having no gateway price (they
  are priced now). Nothing else.
- Work is done by a multi-agent system: **Sonnet writes code and copy, Opus is critic and
  reviewer, Fable (main loop) only decides and directs.**
- Media for landings is generated where the landing type has a slot for it.

## Scope

| Kind | App id | Gateway id | Notes from the catalog |
|---|---|---|---|
| text | `gpt-6.2-sol` | `openai/gpt-6.2-sol` | $2/$10 per 1M, 1.05M ctx, effort low…max, image+PDF |
| text | `gpt-6.2-astra` | `openai/gpt-6.2-astra` | $8/$40, same shape as Sol |
| text | `fable-5.2` | `anthropic/claude-fable-5.2` | $8/$40 (5.1 is $10/$50), effort low…max, image+PDF |
| text | `gemini-4-neon` | `google/gemini-4-neon` | $3/$15, effort low…xhigh, image+PDF+video in |
| text | `gemini-4-hydrogen` | `google/gemini-4-hydrogen` | $1.5/$7.5, effort low…xhigh |
| text | `gemini-4-carbon` | `google/gemini-4-carbon` | $2/$10, effort low…high, coding/agents |
| text | `qwen4-max` | `alibaba/qwen4-max` | $1.5/$4.5, 1M ctx, toggle + effort low/high/xhigh, vision |
| text | `muse-ember` | `meta/muse-ember` | $0.10/$0.50, 1M ctx, effort minimal…max, image+PDF |
| image | `gpt-image-2.6-sunburst` | `openai/gpt-image-2.6-sunburst` | token-priced like 2.5 |
| image | `gpt-image-2.6-flare` | `openai/gpt-image-2.6-flare` | token-priced like 2.5 |
| image | `mai-image-2.7` | `microsoft/mai-image-2.7` | token-priced, up to 2048², transparent bg |
| image | `mai-image-2.7-flash` | `microsoft/mai-image-2.7-flash` | cheaper variant |
| image | `seedream-5.5` | `bytedance/seedream-5.5` | $0.02 / $0.035 per image by pixel count |
| image | `flux-3-image-klein` | `bfl/flux-3-image-klein` | $0.008–$0.036 per image by size |
| image | `recraft-v4.1-flash` | `recraft/recraft-v4.1-flash` | $0.007 per image |
| video | `seedance-2.5-flash` | `bytedance/seedance-2.5-flash` | 480p/720p, 4–30 s, token-priced |
| video | `grok-imagine-video-lite` | `spacexai/grok-imagine-video-1.5-lite` | $0.02–$0.14 per second |

Rules carried over from October:
- Older siblings stay in the picker; `DEFAULT_CHAT_MODEL` does not change. A sibling the new model
  replaces is marked "previous generation" in its catalog card, as was done for Qwen 3.7 Flash.
- A capability the probes do not confirm gets the conservative default: no attachments, no
  thinking picker, no media setting that might be a placebo.
- Media is billed from the gateway `cost`; a model whose probe reports no cost is not shipped.

Not included: `-fast` / `-batch` / `-ultrafast` variants, Tencent Hy4, MiniMax H3 Image, Gemini
Omni 1.2 Flash, niche vendors, and non-chat types (speech, realtime, evaluation, reranking).

## Files that change

Pattern is the one in `afc1f7d` and `85c0626`; agents read those diffs first.

- **Registry**: `lib/ai/models.ts` (entries, `openaiModelIds` / `googleModelIds`,
  `OPENAI_IMAGE_GATEWAY_MAP`, `DEDICATED_IMAGE_GATEWAY_MAP`, `videoGenConfig` sections),
  `lib/ai/providers.ts`, `lib/ai/entitlements.ts`, `messages/ru.json` (names, descriptions),
  `lib/ai/__tests__/model-registry.test.ts`. `app/(chat)/api/chat/_lib/image/*` and
  `handlers/video-generation.ts` only if a probe shows a model needs its own adapter or option.
- **Landings**: `lib/marketing/model-landings/{openai,anthropic,google,alibaba,meta}.ts`,
  `{image-openai,image-microsoft,image-bytedance,image-bfl,image-recraft}.ts`,
  `{video-bytedance,video-xai}.ts`, plus the shared files `shared.ts`, `index.ts`,
  `lib/marketing/models-catalog.ts`, `lib/marketing/landing-content.ts`,
  `lib/agent-discovery/markdown/home.ts` if it lists models.
- **Media**: `public/images/model-landings/{slug}/*.webp`, four renders per image model (one hero
  sample and three audience samples), each produced by the model its landing is about
  (`LandingMediaSample` in `model-landings/types.ts`). Video landings have no media slot in the
  types, so no clips are generated.
- **Tooling fix**: `scripts/fetch-gateway-models.ts`. `pnpm models:list` fails today because the
  installed `@ai-sdk/gateway` rejects the catalog's new model types (`evaluation`, `realtime`, …).
  The script switches to the public `/v1/models` endpoint; no dependency upgrade.
- No DB migration, no new `ModelProvider`, no new logo.

## Order of work (multi-agent system)

Branch `feat/november-2026-models` in the main checkout. Agents are started with the Agent tool;
each stage ends at a gate where Fable reads the result and decides. Parallel writers own disjoint
files, so nobody edits a file another agent has open.

1. **Probe** (Sonnet ×1). Minimal paid calls through the gateway for all 17 ids, from a script in
   the scratchpad: a ~16-token chat turn per text model (reasoning parts, effort values accepted,
   image and PDF input, `providerMetadata.gateway.cost`), one image per image model (accepted
   size / aspect / quality params, edit input, reported cost, output format), one shortest 480p
   clip per video model (duration, wall time, cost). Output: `facts.json`.
2. **Critic gate** (Opus ×1). Attacks `facts.json` and the wiring table Fable drafts from it
   (thinking configs, attachment flags, `estimatedCostUsd`, video duration caps, slugs). Fable
   settles every objection before any code is written.
3. **Build** (Sonnet ×3, parallel, disjoint files)
   - Registry coder: everything under "Registry" plus the tooling fix.
   - Text-landing writer: the five text vendor modules.
   - Media-landing writer: the seven image/video vendor modules and the 28 renders (prompts
     written for each landing, generated through the gateway, converted to WebP with `sharp`).
   Landing writers hand their catalog cards, slugs and cross-links back as data.
4. **Integrate** (Sonnet ×1). Wires the shared marketing files from that data, runs `pnpm check`.
5. **Review** (Opus ×2, parallel, read-only)
   - Reviewer: the repo's `review` agent on the full diff (billing, routing, registry
     consistency, conventions).
   - Critic: every landing against `facts.json` (no claim the probes or catalog do not support),
     SEO fields, Russian copy quality, and each render opened and judged against its caption.
6. **Fix** (Sonnet ×1) applies the findings Fable confirms; re-review by Opus until clean, at
   most two rounds.
7. **Final check by Fable**: `pnpm check`, `pnpm models:list`, the preview pass below, then atomic
   conventional commits on the branch. No push and no PR until the owner asks.

## Risks

- **Paid calls.** Probes and renders spend real gateway money; expected under $10, hard stop at
  $15. The video probes are the costly part and use the shortest clip at the lowest resolution.
- **Catalog facts are not runtime facts.** October showed the catalog mis-states inputs and
  options (MAI edits, Wan resolution, Grok video namespace). The probe stage exists for this; a
  model that fails its probe is dropped from the PR and reported, not shipped on catalog data.
- **GPT-6.2 reasoning.** Sol and Astra list no `none` effort, like 6.1 Sol; they get
  `GPT6_ALWAYS_REASONING_THINKING_CONFIG` unless the probe says otherwise.
- **Seedance 2.5 Flash** has no 1080p tier and allows 30 s clips. Durations offered in the UI are
  capped by measured wall time against the 800 s route limit, so a clip cannot time out before
  `chargeUsageSafe` runs.
- **Token-priced image models** (GPT Image 2.6, MAI 2.7) need `estimatedCostUsd` from a real
  generation, otherwise the balance gate uses the per-mode floor.
- **Seedream 5.5** lists PDF input; it is wired as a plain image model unless the probe shows
  edits work the way Seedream 5.0 Pro's do.
- **Render quality.** A weak render ships a weak landing. The critic rejects renders with
  artefacts or broken text; the writer regenerates within the budget.
- **Shared files.** `models.ts`, `ru.json` and `models-catalog.ts` each have a single owner per
  stage; the integrate step is sequential.

## Verification

- `pnpm check` (typecheck, Biome, unit tests incl. `model-registry.test.ts`,
  `model-landings.test.ts`, `landing-links.test.ts`, `next build`).
- `pnpm models:list` runs again and every new gateway id is present in its output.
- Dev server (`preview_start`): open each of the 17 `/models/{slug}` pages and the `/models`
  catalog, check the console for errors, check that every render loads, and screenshot one text,
  one image and one video landing at desktop and mobile width.
- In the local app with a tester user: one message on each new text model, one generation on each
  new image model, one short clip on each video model, each producing a non-zero `Transaction`.
- After deploy (owner): first prod `Transaction` per model is close to gateway cost × markup.

## Departures from the plan

Found by the probes and the two Opus reviews; each was decided by the orchestrator.

- **Seedream watermark, all four models.** Without `providerOptions.bytedance.watermark = false`
  Seedream 5.5 and the existing 5.0 Pro return a visible "AI generated" mark. The option was
  probed on 5.5, 5.0 Pro, 5.0 Lite and 4.5 (accepted, clean output) and is now sent for every
  `bytedance/` image id. This changes three models that were already live.
- **New `pdfInput` capability.** Qwen 4 Max rejects a PDF part with a hard error and the server
  sends every file in the history, so one PDF would break the chat. `omitUnsupportedPdfs`
  replaces PDF parts with a text note for such a model; the attach menu, file picker and
  drag-and-drop refuse PDFs for it. Only `qwen4-max` carries the flag.
- **`estimatedCostUsd` is the worst case plus headroom**, not the cost at the defaults: the
  balance gate uses one number per model and the charge floors at zero. Side effect: a 5 s
  Seedance 2.5 Flash clip needs a balance that covers the 10 s price.
- **Image path.** A model with `attachments: false` (Recraft V4.1 Flash, whose edits hard-error)
  no longer picks up an earlier image for an edit. The dedicated provider uses the media type the
  SDK reports instead of a fixed `image/png`. `supportsImageGenConfig` now needs a real picker
  section (Recraft Flash carries a config that holds only the cost); no existing model changes.
- **Pickers.** MAI-Image-2.7, 2.7 Flash and FLUX 3 Image Klein get a three-option aspect picker
  (1:1, 16:9, 9:16), probed for generation and edits. Recraft V4.1 Flash gets none and goes
  through the dedicated path, never through `recraft-client.ts` (it hard-codes the Pro id).
  Qwen 4 Max and Muse Ember get no reasoning picker: both ignore the effort value.
- **Seedance 2.5 Flash** runs at the gateway default, which is 720p (5 s: $0.76, 75 s; 10 s:
  $1.52, 88 s), with 5 s and 10 s offered.
- **Existing pages edited.** Adding the models made older pages false: GPT-6 Astra, GPT-6.1 Sol,
  Fable 5.1, Qwen 3.8 Max and Max Prime, Gemini 3.8 Flash, Seedream 5.0 Lite and MAI-Image 2.6
  Flash were repositioned as previous-generation models. Two claims that were already false were
  fixed in passing: "newest" on Gemini 3.6 Flash and video input on Gemini 3.8 / 3.7 Flash.
- **Order of work.** The text-landing writer started before the critic gate finished and the
  code review ran before integration, because those inputs were already settled.

## Result

- 17 models wired, 17 landings, 28 renders (6 regenerated after the content review).
- `pnpm check` passes (typecheck, Biome, unit tests, `next build`); `pnpm models:list` works
  again and lists all 17 gateway ids.
- Local app, tester user, 2026-11-20: one turn on each of the 17 models through `POST /api/chat`.
  All 17 answered and each wrote one `usage_debit` `Transaction` equal to the gateway cost x 2.0
  markup x FX (from $0.0006 for Muse Ember to $0.76 for a 5 s Seedance 2.5 Flash clip).
- All 17 `/models/{slug}` pages and the catalog render in the dev server, with every render
  loading and no horizontal scroll at 375 px.
- Gateway spend for probes, renders and the local turns: about $8.40.

## Left for later (not caused by this change)

- The media handlers charge after the upload: if the upload throws, a clip the provider already
  billed (up to $1.52 for Seedance 2.5 Flash) is not charged.
- `MEDIA_FILE_TYPES.image` is still `image/png`, so the stored file part says png for a JPEG or
  WebP blob.
- Qwen 3.8 and the Moonshot models are still marked "vision only" by comment alone; they were not
  probed for PDF behaviour.
