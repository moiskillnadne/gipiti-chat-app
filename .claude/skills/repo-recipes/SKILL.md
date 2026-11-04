---
name: repo-recipes
description: Step-by-step recipes for this repo — modifying the database schema (Drizzle), adding a new AI model to the registry, or adding a new AI tool. Use whenever changing lib/db/schema.ts, lib/ai/models.ts, or lib/ai/tools/.
---

# Repo Recipes

## Modifying Database Schema
1. Update schema in `lib/db/schema.ts`
2. Run `pnpm db:generate` to create migration
3. Run `pnpm db:migrate` to apply changes
4. Update types in `lib/types.ts` if needed

## Adding a New AI Model
1. Add provider import in `lib/ai/models.ts`
2. Define model with capabilities in `chatModels` array
3. Add provider mapping in `lib/ai/providers.ts`
4. Update subscription tier `modelLimits` in `lib/subscription/subscription-tiers.ts`
5. Test quota enforcement and cost tracking

## Adding a New AI Tool
1. Create tool file in `lib/ai/tools/`
2. Define with Zod schema using AI SDK's `tool()` helper
3. Register in the `chatTools` object in `app/(chat)/api/chat/_lib/handlers/text-chat.ts`
4. Add tool type to `ChatTools` in `lib/types.ts`
5. Create result renderer component if needed (in `components/`); document-producing tools reuse `DocumentPreview` and must be listed in `lib/messages/group-tool-runs.ts` so the card renders outside the tool-run box
