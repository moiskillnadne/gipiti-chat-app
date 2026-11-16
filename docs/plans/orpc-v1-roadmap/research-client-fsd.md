# Research: the client code under Feature-Sliced Design, and how FSD fits with the Next.js App Router

Scope: map GIPITI's client code onto FSD, decide how FSD and the App Router share the repo, list the tooling that is affected, and lay out the migration steps.
Repo: `/Users/victorryabkov/projects/personal/gipiti/app` (branch `chore/gipiti-127-sharp-vitest-lockfile`, clean).
Method: everything here was read only. I built a static import graph of every `.ts/.tsx/.mjs` outside `node_modules`, `.next` and `.claude`, with a script kept in the scratchpad (`tools/graph.mjs`, `tools/client2.mjs`). For each import it records the resolved target, whether it is `import type`, and whether the file carries `"use client"`, `"use server"` or `import "server-only"`.

How to read this:
- **[obs]** means I observed it in the repo, with a `path:line` citation.
- **[doc]** means I verified it against official docs or installed packages.
- **[inf]** means it is my inference or recommendation.
- **UNVERIFIED** means I could not confirm it.

---

## 0. TL;DR (decisions recommended)

1. **One `src/` root for all application code, in the owner's admin-dashboard style.**
   - `src/app` holds Next routing files only.
   - `src/client` holds the FSD layers.
   - `src/server` holds the API and domain.
   - `src/core` holds isomorphic, framework-free code: model registry, money, i18n, constants.
   - `src/contract` holds the oRPC contract and DTOs (exact name to be agreed with the server research).
   - `public/`, `content/`, `assets/`, config files and `.env*` stay at the repo root.
   - The alias becomes `"@/*": ["./src/*"]`, so imports read `@/client/features/...` and `@/server/...`.
2. **Inside `src/client` the FSD layers keep their canonical names** (`app`, `pages`, `widgets`, `features`, `entities`, `shared`). Next only special-cases a root `app/`/`pages/` or `src/app`/`src/pages`, so `src/client/pages` cannot collide. If Steiger or a human finds that confusing, the fallback is the FSD guide's `_app`/`_pages`.
3. **`src/app/**` is the only place where client and server meet.** Each `page.tsx` or `layout.tsx` does three things: an auth guard, data loading through the in-process oRPC server client (no HTTP to itself), and rendering a page slice from `@/client/pages/<x>`.
   - `src/client/**` never imports `@/server/**`, except an explicitly allowed `import type` of the router type if the server picks router-first instead of contract-first.
   - Server Components inside `src/client` stay pure (props in, JSX out).
4. **Phase 0 is a single mechanical commit**: move `app components hooks contexts lib types proxy.ts instrumentation.ts messages` into `src/`, and set `@/*` to `./src/*`.
   - Every `@/…` import keeps resolving with no edits.
   - The only fixes are relative paths that escape: the JSON imports in `lib/i18n`, the `@source` path in `globals.css`, `drizzle.config.ts`, the `package.json` scripts, `components.json`, `biome.jsonc` ignores, the vitest alias, the protected-paths hook and docs.
   - Restricting tsconfig `include` to `src/**` and similar also fixes the stale-worktree problem (`tsconfig.json:28-35` currently includes `**/*.ts` and excludes only `node_modules`).
5. **Then move code bottom-up per domain** (shared, then entities, features, widgets, pages), using `git mv` plus a scripted specifier rewrite. **No re-export shims.** It is a single app and every importer is in the repo, so each PR rewrites all importers and keeps `pnpm check` green.
6. **Delete dead code first.** There are 20 orphan client files, including `sign-out-form.tsx`, `use-cancel-subscription.ts`, half of `components/elements` and several `components/*.tsx`; see §2.6.
7. **Enforce boundaries with Biome, which is already installed:**
   - `style/noRestrictedImports` with `patterns`, available from v2.2.0 (installed 2.2.2), configured in path-scoped `overrides`.
   - `performance/noBarrelFile` (ultracite sets it to `error`) turned off only for slice `index.ts` files.
   - `noReExportAll` turned on for `src/client`.
   - Steiger is the FSD-native linter, but it is beta and not installed, so it is optional.
   - Same-layer cross-slice imports cannot be expressed generically in Biome patterns. That needs per-slice overrides or a 50-line graph check inside `scripts/check.ts`.
8. **Biggest structural debts to resolve while moving, because they matter for mobile:**
   - 14 UI files import Drizzle row types from `lib/db/schema` and should use contract DTOs.
   - `ChatMessage` in `lib/types.ts:3-13` is type-derived from the server tool implementations.
   - `multimodal-input.tsx:18-21` imports types from a route file.
   - A Server Component queries the DB directly (`app/subscription/_components/plan-card.tsx:6-7`).
   - Client components read the "seed-only" subscription catalog (`plans-grid-card.tsx:5,27,36`, `payment-utils.ts:1`).

---

## 1. FSD and Next.js facts (verified)

### 1.1 FSD essentials [doc]
Sources: https://feature-sliced.design/docs/reference/layers, …/public-api, …/guides/tech/with-nextjs, all fetched 2026-11-15.

- **Layers, top to bottom:** app, processes (deprecated, "move its contents to Features and App"), pages, widgets, features, entities, shared. Not every layer is required, and adding custom layers is discouraged.
- **Import rule:** a module may import only from slices on layers strictly below its own. Siblings inside the same slice can import each other freely.
- **Sliced layers:** pages, widgets, features, entities.
  - `app` and `shared` have no slices. They consist directly of segments, and those segments may import each other.
- **Same-layer slices cannot import each other.** The only sanctioned exception is the Entities layer, through `entities/A/@x/B.ts` cross-reference files, kept to a minimum.
- **Segment names should describe purpose:**
  - shared: `api ui lib config routes i18n`
  - app: `routes store styles entrypoint`
  - entities and features: `ui api model (config)`
  - pages: `ui api`
  - The docs discourage `components`, `hooks` and `types` as segment names.
- **Public API:**
  - Each slice exposes an `index` file. No `export *`.
  - Use relative imports inside a slice and alias imports across slices, which avoids index-induced cycles.
  - `shared/ui` and `shared/lib` should have **one index per component or library, not a root barrel**, because a root barrel defeats tree-shaking.
  - The docs also note that many index files can slow bundlers and dev servers.
  - If modules for different environments would be bundled together, split the public API into environment-specific files.
- **Next.js guide:**
  - Rename the FSD `app`/`pages` layers to `_app`/`_pages` "regardless of which router you use". The guide says this is Steiger-compatible.
  - Root `app/` holds only routing files that re-export page slices, e.g. `export { ExamplePage as default, metadata } from "@/_pages/example"`.
  - FSD layers live in `src/`. Having the Next folders at the root is "not mandatory".
  - Server-only exports from a slice go into `index.server.ts`, so `server-only` side effects do not leak into the client graph.
  - Route handler logic goes in `_app/api-routes`, with the warning that "FSD is primarily intended for frontends" and the suggestion to use a separate package when there are many endpoints.
  - DB queries go in a `shared/db` segment.
  - **For GIPITI I diverge on the last two points [inf].** The owner explicitly wants server code in `server/`, and the REST API is a first-class backend for mobile, so it should not be hidden inside a frontend architecture.

### 1.2 Next.js 16.4.6 constraints [doc]
Sources: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/src-folder.md`, `proxy.md:25`, `instrumentation.md:12`, `01-getting-started/02-project-structure.md:257-282`.

- The App Router may live at `src/app`. **`src/app` is ignored if a root `app` exists.** So the move must be atomic; a half-moved state silently serves the old tree.
- `public/`, config files and `.env*` must stay at the root.
- `proxy.ts` and `instrumentation.ts` must sit next to the router: at the root, or inside `src/` when `src/app` is used.
- If you use `@/*` paths, update `paths` in tsconfig to point into `src/`.
- Private folders (`_name`) and route groups exist for colocation, but the docs note colocation inside `app/` is safe without them.
- [inf] Next looks for the Pages Router only at `pages/` or `src/pages/`, so `src/client/pages` is not a Next convention. This is consistent with `src-folder.md`; I did not test it in a build. **UNVERIFIED in practice.**

### 1.3 Tool versions installed [obs]
| Tool | Version | Evidence |
|---|---|---|
| next | 16.4.6 | package.json |
| react | 19.2.7 | package.json |
| @biomejs/biome | 2.2.2 | `node_modules/@biomejs/biome/package.json` |
| ultracite | 5.3.9 | package.json; `lint` = `ultracite check` |
| typescript | 5.8.2 | `node_modules/typescript/package.json` |
| vitest / vite | 4.1.12 / 7.1.6 | node_modules |
| zod | ^3.25.76 (**not Zod 4**) | package.json |
| tailwindcss | ^4.3.5 (CSS-first config) | package.json:101, `app/globals.css:1-8` |
| swr | ^2.2.5; no TanStack Query in the app | package.json:78 |
| steiger, @feature-sliced/* | **not installed** | `ls node_modules` |
| @testing-library/*, jsdom, happy-dom, msw | **not installed** | grep package.json |
| oRPC (admin-dashboard) | @orpc/server and @orpc/client 1.15.7 | `admin-dashboard/node_modules/@orpc/*/package.json` |

---

## 2. Inventory of today's client code [obs]

### 2.1 Size
Counts from `find -type f`:
- `components/`: 208 files, 188 of them TS/TSX.
- `hooks/` 9, `contexts/` 3, `types/` 3, `messages/` 2 (`ru.json` is 128 KB), `public/` 105.
- `app/`: 172 TS/TSX files, of which 90 are pages, layouts and colocated UI rather than API.
- `lib/`: 266 TS files.

There are 167 `"use client"` files. 291 modules are reachable from them at runtime, not counting `"use server"` edges and type-only imports.

`components/` layout:
- Root: 50 single files.
- Subfolders: `blog/` (6 plus `preview/` 6), `composer/` 12, `elements/` 25, `icons/` (logos.tsx plus SVGs), `landing/` 16, `models/` (7 plus `landing/` 14), `prompt-library/` 6, `quiz/` 9 plus a CSS module, `styles-projects/` 1, `ui/` (29 shadcn files plus `model-selector/` 9).

UI colocated under `app/`:
- `app/subscription/_components` 16 files plus 2 CSS modules.
- `app/subscription/manage/_components` 13 plus a CSS module.
- `app/subscription/verify-email/_components` 2.
- `app/(auth)/manage-subscription/{components,hooks,utils}` 7.
- `app/(auth)/{login,register}/*-page-client.tsx`.

### 2.2 Folder-level import graph (runtime and type edges; counts are import statements)
Abridged; the full list was produced by `tools/analyze.mjs folders`.

```
app(ui)            -> components/* (≈90), lib/i18n 44, lib/billing 25, lib/db 16, lib/subscription 16,
                      lib/marketing 10, lib/utils 11, lib/seo 8, lib/flags 5, contexts 3, hooks 3, …
components/chat    -> chat-header, messages, multimodal-input, sidebar-history, data-stream-provider,
                      contexts(3), hooks(2), lib/db(type), lib/types, lib/usage, lib/messages, lib/errors
components/message -> assistant-icon, elements(5), message-actions, message-attachments, message-editor,
                      tool-run-renderer, toast, hooks, lib/ai, lib/db(type), lib/download, lib/messages
components/multimodal-input -> composer(10), elements(2), contexts(2), hooks(2), lib/ai, lib/attachments,
                      lib/chat, lib/usage, app/(chat)/api/files/upload/route (type)
components/composer -> ui 5, contexts 4, hooks 3, lib/ai 4, lib/i18n 9, lib/utils 12
components/elements -> ui 26, hooks 2, lib/media 4, lib/i18n 8, lib/ai, lib/usage, lib/types
components/ui       -> lib/utils 32, lib/ai 9 (model-selector), lib/i18n 8, contexts 1 (model-selector), hooks 1
components/landing  -> lib/marketing 11, lib/agent-discovery, icons
components/models   -> lib/marketing 26, landing 3, icons
components/blog     -> lib/blog 14, lib/i18n 8, elements
contexts            -> app/(chat)/actions (4 runtime "use server"), app/(auth)/auth (type), lib/ai 2, lib/db(type)
hooks               -> components/data-stream-provider, components/toast, lib/download, lib/media, lib/types
lib/subscription/use-cancel-subscription.ts -> components/toast   (the only lib→components edge)
```
**No runtime import cycles.** Tarjan's strongly-connected-components check over runtime edges returned none.

### 2.3 Server actions imported by client code
Both actions files are `"use server"`.
- `app/(auth)/actions.ts`: `login`, `register`, `verifyEmail`, `resendVerificationCode`, `requestPasswordReset`, `resetPassword` (lines 61-412). Imported by:
  - `forgot-password/page.tsx`, `login/login-page-client.tsx`, `register/register-page-client.tsx`, `reset-password/page.tsx`
  - `subscription/_components/reward-banner.tsx`
  - `subscription/verify-email/_components/verify-email-client.tsx`
- `app/(chat)/actions.ts`:
  - The `save*AsCookie` functions (model, thinking, image and video settings, web search, project; lines 19-78), imported by `contexts/model-context.tsx:25`, `contexts/web-search-context.tsx:14` and `contexts/project-context.tsx:15`.
  - `deleteTrailingMessages` (line 89), imported by `components/message-editor.tsx:13`.

[inf] For FSD these become the `api` segments of the relevant features (`features/auth`, `features/model-select`, `features/web-search-toggle`, `features/project-select`, `features/edit-message`), calling oRPC procedures instead. The cookie-only preferences should become user-preference endpoints (`/v1/me/preferences`), because a mobile app has no cookie jar to share with the web. That is the server team's call.

### 2.4 Boundary violations (client code reaching server code)
None of these is a runtime leak of `lib/db` into the client bundle; the client graph never reaches `lib/db/connection.ts`. They are architectural couplings that block a clean split or a mobile contract.

| # | Where | What | Fix in the target structure |
|---|---|---|---|
| V1 | 14 UI files, e.g. `components/chat.tsx:25`, `messages.tsx:8`, `message.tsx:9`, `sidebar-history.tsx:25`, `project-manager.tsx:4`, `prompt-library/prompt-library.tsx:9`, `contexts/project-context.tsx:16`, `styles-projects/editor-v1.tsx:8` | `import type { Chat, Vote, Project, ProjectFile, Prompt } from "@/lib/db/schema"`: UI typed by Drizzle rows | Use DTO types from `src/contract` (zod-inferred), re-exported by `entities/*/model`. This is what the OpenAPI spec will describe anyway. |
| V2 | `lib/types.ts:3-13`, used by ~15 UI files | `ChatMessage`/`CustomUIDataTypes` are built with `InferUITool<typeof serverTool>` from `lib/ai/tools/*` and use `Prompt` from the DB schema | Move the UI-message type to `src/contract/chat` with explicit zod or TS tool-part types. Server tools then *satisfy* the contract rather than defining it. Mobile needs this type too. |
| V3 | `components/multimodal-input.tsx:18-21` | `import type { UploadErrorBody, UploadErrorCode } from "@/app/(chat)/api/files/upload/route"` | Becomes a contract error type. |
| V4 | `contexts/model-context.tsx:14` | `import type { UserType } from "@/app/(auth)/auth"` | Becomes a contract or `entities/user` type. |
| V5 | `components/sign-out-form.tsx:3` | Runtime import of `signOut` from `app/(auth)/auth` with an inline `"use server"`. **The file is an orphan.** | Delete it. Sign-out becomes `features/auth` calling `/v1/auth/sign-out`. |
| V6 | `app/subscription/_components/plan-card.tsx:6-7` | A *component* (RSC) calls `getUserById` (DB) and `isTopupEnabled` (flags) | Data is loaded in the route file and passed as props. |
| V7 | `app/subscription/_components/plans-grid-card.tsx:5,27,36` (`"use client"`), `app/(auth)/manage-subscription/utils/payment-utils.ts:1` | Read prices from `lib/subscription/subscription-tiers.ts`, which CLAUDE.md calls **seed-only**; the runtime catalog is in the DB. Client prices can drift from what is charged. | Read prices from a `/v1/subscriptions/plans` endpoint and keep them in `entities/subscription`. Flag this to the server and billing research. |
| V8 | `lib/subscription/use-cancel-subscription.ts:1,5` | A `"use client"` hook living in `lib/` and importing `components/toast` (inverted dependency). Orphan. | Delete it, or move it to `features/cancel-subscription/model`. |
| V9 | `components/ui/model-selector/*` | A domain feature (imports `contexts/model-context`, `lib/ai/*`) hidden inside the shadcn folder, which `biome.jsonc:7` excludes from linting (`"!components/ui"`) | Move to `features/model-select`. It then gets linted. |
| V10 | `contexts/*` | Client state providers that persist through server actions | `features/*/model` providers, mounted by the `app` layer. |

### 2.5 Isomorphic `lib` modules (client graph and server graph)
These are reachable at runtime from `"use client"` files and from API routes, `server-only` or `"use server"` modules:

```
lib/ai/models.ts (2,252 lines!)       lib/billing/money.ts, lib/billing/constants.ts
lib/attachments/attachment-limits.ts  lib/errors.ts (ChatSDKError)
lib/i18n/{dictionary,format,translate}.ts   (translate.ts imports only ./dictionary, ./format — no React)
lib/messages/interrupted.ts           lib/quiz/types.ts
lib/subscription/cancellation-reasons.ts, lib/subscription/subscription-tiers.ts (seed data, see V7)
lib/marketing/{landing-content,models-catalog}.ts  lib/blog/{frontmatter,reading-time,schema}.ts
lib/agent-discovery/constants.ts      lib/utm/constants.ts      lib/utils.ts (cn + misc, see below)
```
The following are used by client code but not by API or server-only code. Server Components and pages may still use them.

```
lib/ai/{entitlements,model-capability,model-speed}.ts  lib/attachments/attachment-display.ts
lib/chat/input-draft.ts  lib/client-logger.ts  lib/client-diagnostics.ts  lib/dom/dom-mutation-guard.ts
lib/download.ts  lib/i18n/errors.ts  lib/marketing/{hero-media,landing-links}.ts
lib/media/{aspect-ratio,collect-chat-media}.ts  lib/messages/group-tool-runs.ts
lib/payments/cloudpayments-widget.ts  lib/prompts/prompt-meta.ts  lib/styles-projects/templates.ts
lib/url.ts  lib/utils/swatch.ts  lib/validation/password.ts  lib/agent-discovery/webmcp-tools.ts
```
`lib/utils.ts` (158 lines) mixes `cn` (UI), `fetcher`/`fetchWithErrorHandlers` (client HTTP), `generateUUID`, and `convertToUIMessages(DBMessage[])` (server/DB mapping). Split it: `shared/lib/cn.ts`, `shared/api/http.ts` (deleted once the oRPC client lands), `core/lib/uuid.ts`, and a server mapper.

### 2.6 Dead code: orphans in the static import graph
These files have no importer. Re-check them with a quick grep for dynamic or string usage before deleting.
```
components/cancellation-feedback-dialog.tsx  components/sign-out-form.tsx  components/suggested-actions.tsx
components/url-extract-input-preview.tsx  components/url-extract-result.tsx  components/usage-limits-widget.tsx
components/video-player.tsx  components/web-search-input-preview.tsx  components/web-search-result.tsx
components/elements/{branch,context,image,inline-citation,task,tool,usage-hint,web-preview}.tsx
components/ui/{chip,input-otp,radio-group}.tsx   lib/subscription/use-cancel-subscription.ts  lib/format-tokens.ts
```
`components/ui/*` orphans are shadcn primitives, so keeping them is harmless.

### 2.7 Oversized files (>200 lines; the house rule is <200 for components)
`components/icons.tsx` 1256 · `components/ui/sidebar.tsx` 774 (shadcn, leave) · `entity-gallery.tsx` 692 · `styles-projects/editor-v1.tsx` 663 · `tool-run-renderer.tsx` 538 · `message.tsx` 529 · `multimodal-input.tsx` 517 · `elements/media-preview.tsx` 498 · `app/(auth)/actions.ts` 456 · `elements/tool-run.tsx` 446 · `manage-subscription/hooks/use-payment.ts` 425 · `contexts/model-context.tsx` 386 · `sidebar-history.tsx` 381 · `verify-email-client.tsx` 372 · `chat.tsx` 349 · `subscription/_components/icons.tsx` 339 · `top-up-dialog.tsx` 322 · `landing/chat-mockup.tsx` 312 …, about 45 files in total. `lib/ai/models.ts` is 2,252 lines.

### 2.8 Existing barrels and tests
- **Barrels.** There are four `index.ts(x)` files: `lib/marketing/model-landings/index.ts`, `lib/subscription/billing-periods/index.ts` (line 1: `// biome-ignore-all lint/performance/noBarrelFile`), `lib/agent-discovery/markdown/index.ts` and `components/ui/model-selector/index.tsx`.
- **Tests.**
  - Vitest uses `environment: "node"` and `include: ["**/__tests__/**/*.test.ts"]` (`vitest.config.ts:6-8`), so there are **zero React component tests and no `.test.tsx` support**.
  - `__tests__` exist under `lib/*` (18 dirs), `app/(chat)/api/**`, `app/api/**` and `scripts/hooks`.
  - Playwright has `tests/e2e/{chat-input,login}.test.ts` plus `tests/routes` projects (`playwright.config.ts:26,58,65`).

---

## 3. Target layout

### 3.1 The constraint and the choice
- **Constraint [doc]:** Next detects the router only at `app/` or `src/app/`, root wins, and `proxy.ts`/`instrumentation.ts` must sit next to it. The FSD guide puts Next's folders at the root and FSD in `src/` with `_app`/`_pages`, and says this is optional.
- **Options considered:**
  - **A. Root `app/` + `src/` (FSD) + root `server/`.** This is the FSD guide's layout. It has three code roots at the top level, next to about 20 config and data folders. It needs either several aliases (`@/entities/*`, `@/server/*`, …) or imports like `@/src/...`. Vitest's `"@"` alias would need ordered entries. The root stays crowded, which is the owner's complaint.
  - **B. Everything under `src/` (recommended).** It matches the owner's own `admin-dashboard` (`src/app`, `src/server`, `src/features`, `tsconfig "@/*": ["./src/*"]`, observed in `admin-dashboard/tsconfig.json`). It needs one alias. The root keeps only config, `public/`, `content/`, `assets/`, `tests/`, `scripts/` and `docs/`. Client and server are visibly separate siblings.
  - **C. FSD layers directly in `src/`** (`src/features`, `src/entities`, … next to `src/server`). This is closer to the FSD guide, but client and server are then not grouped, which goes against the owner's main complaint.

**Recommended tree:**
```
src/
  app/                     # Next.js App Router ONLY: page/layout/route/error/not-found/loading,
                           #   metadata files (sitemap, manifest, robots, opengraph-image), .well-known
  client/                  # FSD root (steiger ./src/client)
    app/                   #   FSD app layer: providers, styles (globals.css), analytics, error logging
    pages/                 #   page slices (not a Next convention here — see §1.2)
    widgets/
    features/
    entities/
    shared/                #   ui/ lib/ api/ config/ i18n(client glue)
  server/                  # oRPC routers by URL path, services, db, integrations (owned by server research)
  contract/                # oRPC contract + zod DTOs + error codes; isomorphic; later packages/contract
  core/                    # isomorphic, framework-free domain code (no React, no Node/DB)
  proxy.ts                 # must sit next to src/app  [doc]
  instrumentation.ts       # must sit next to src/app  [doc]
  types/                   # ambient *.d.ts (next-auth, svg, webmcp)
public/  content/  assets/  tests/  scripts/  docs/  (+ root config files)
```
**Dependency rules [inf]:**
```
src/app      -> client/*, server/*, contract, core        (composition root; the only meeting point)
src/client   -> contract, core                            (never server/ — except `import type` of the
                                                            router if server goes router-first)
src/server   -> contract, core                            (never client/)
src/contract -> core (zod only)
src/core     -> nothing in src/ (pure TS + zod)
inside src/client: FSD import rule (app > pages > widgets > features > entities > shared)
```
`src/core` vs `src/client/shared`:
- Code goes in `core` only when the server also needs it: model registry, money math, billing constants, i18n dictionary/format/translate, attachment limits, errors, quiz types, UTM constants and marketing/blog content schemas.
- UI-only helpers stay in `client/shared`.

**The name `core` is a proposal; reconcile it with the server research.** If the server layout already has a `server/domain`, the isomorphic subset could also be `src/shared` *outside* `client/`. I avoided that name because it collides with the FSD `shared` layer.

### 3.2 Slices (concrete list)

**`client/shared`** (no slices; per-module public API, no root barrel):

| Segment | Contents |
|---|---|
| `ui/` | shadcn primitives (from `components/ui/*` minus model-selector and model-dot), `toast`, `submit-button`, `password-input`, `route-error-fallback`, `fade-in`, `support-link`, `icons/` (split `components/icons.tsx` 1256 lines into per-icon files or groups) |
| `ui/ai-elements/` | the generic Vercel ai-elements kit: `actions`, `code-block`, `conversation`, `loader`, `message`, `prompt-input`, `source`, `suggestion` |
| `lib/` | `cn.ts` (from `lib/utils.ts`), `download.ts`, `logger/` (`client-logger`, `client-diagnostics`), `url.ts`, `dom/` (mutation-guard logic), `hooks/` (`use-mobile`, `use-is-mac`, `use-double-click-zoom-toggle`, `use-scroll-to-bottom`) |
| `api/` | `orpc-client.ts` (`createORPCClient(new OpenAPILink(...))` or RPCLink, typed from the contract), the query provider or utils, a temporary `http.ts` (`fetcher`) until SWR calls are migrated |
| `config/` | client constants, route paths (`routes.ts`) |
| `i18n/` | a thin client re-export of `@/core/i18n` (or import core directly) |

**`client/entities`:**

| Slice | ui | model / lib / api |
|---|---|---|
| `model` (AI model) | `model-badge`, `model-dot`, `assistant-icon`, `provider-logo` (from `components/icons/logos.tsx` plus SVGs), `speed-gauge` | lib: `model-capability`, `model-speed`, `entitlements` (client part); model: re-exported registry types from `@/core/ai/models` |
| `chat` | `chat-list-item` (from `sidebar-history-item.tsx`) | model: `ChatDto`; api: `useChatHistory` (from `sidebar-history.tsx` SWR infinite) |
| `message` | `response` (markdown), `tool-run`, `tool-run-renderer` (split), `document-preview`, `media-preview` (+styles), `media-lightbox` (+provider), `media-stopped-card`, `message-attachments`, `web-search-result`/`url-extract-result` if revived | model: `ChatMessage` (from contract), `data-stream` context (from `components/data-stream-provider.tsx`); lib: `group-tool-runs`, `collect-chat-media`, `aspect-ratio`, `attachment-display`, `interrupted` (core) |
| `project` | project card / file chip pieces of `entity-gallery`, `project-detail` view | model: `ProjectDto`, `ProjectFileDto`; lib: `styles-projects/templates` |
| `prompt` | `prompt-card`, `prompt-placeholders` | lib: `prompt-meta`; model: `PromptDto` |
| `user` (session) | — | model: a session hook wrapping the auth client (replaces direct `next-auth/react` usage) |
| `balance` | balance display atoms (`balance-hero` parts, `status-pill`) | lib: money formatting through `@/core/billing/money` |
| `subscription` | `tariff-card`, plan icons (`app/(auth)/manage-subscription/components/plan-icons.tsx`) | model: plan DTOs (from API, see V7), `cancellation-reasons` (core) |
| `transaction` | token-history rows, `transaction-history-card` and `payment-history-card` rows | api: `useTransactions` |
| `blog-post` | `post-card`, `article-content`, `article-view`, `blog-image` | lib: `format`, `slug` (client), schema and frontmatter from core |

**`client/features`:**

| Slice | From |
|---|---|
| `auth` | `components/auth-form.tsx`, `app/(auth)/login/login-page-client.tsx` (form part), `register-page-client.tsx`, the forgot/reset-password forms, `app/subscription/verify-email/_components/{otp-inputs,verify-email-client}.tsx`, sign-out. api: `/v1/auth/*` replaces `app/(auth)/actions.ts`. |
| `send-message` | submit, stop and draft logic of `multimodal-input.tsx`: `lib/chat/input-draft.ts`, `hooks/use-chat-stop.ts`, `composer/keyboard-hints.tsx` |
| `attach-files` | `composer/{attach-menu,attachment-item,drag-overlay,context-chip}.tsx`, upload API (`/api/files/upload`) |
| `model-select` | `components/ui/model-selector/*` (9 files), model and thinking state from `contexts/model-context.tsx`, `composer/think-popover.tsx` |
| `media-settings` | `composer/{image-settings-popover,video-settings-popover,media-settings-controls}.tsx` plus the media-gen part of `model-context` |
| `web-search-toggle` | `composer/web-search-toggle.tsx`, `contexts/web-search-context.tsx` |
| `project-select` | `composer/project-picker-popover.tsx`, `contexts/project-context.tsx` |
| `spend-warning` | `composer/balance-spend-banner.tsx`, `hooks/use-spend-banner.ts` |
| `message-actions` (vote/copy) | `components/message-actions.tsx` |
| `edit-message` | `components/message-editor.tsx` (+ `deleteTrailingMessages` moved to the API) |
| `stop-generation` | `elements/media-stop-button.tsx`, the stop parts of `use-chat-stop` |
| `resume-stream` | `hooks/use-auto-resume.ts` |
| `download-media` | `hooks/use-media-download.ts` |
| `manage-projects` | create, rename and delete from `entity-gallery.tsx` / `project-manager.tsx` |
| `edit-project` | `components/styles-projects/editor-v1.tsx` (663 lines; split), `lib/utils/swatch.ts` |
| `prompt-favorite`, `prompt-filter` | favorite toggle (`/api/prompts/favorite`); `prompt-filter-tabs`, `prompt-pager` |
| `top-up` | `app/subscription/_components/{top-up-button,top-up-dialog,top-up-stages,use-topup-amount}.tsx`, `top-up.module.css`, `lib/payments/cloudpayments-widget.ts` |
| `subscribe` (plan purchase) | `app/(auth)/manage-subscription/hooks/{use-payment,payment-reducer}.ts`, `utils/payment-utils.ts`, `components/payment-loading-overlay.tsx` |
| `cancel-subscription` | `app/subscription/manage/_components/{cancel-button,cancel-flow-dialog,cancel-stages}.tsx` |
| `resume-subscription` | `.../manage/_components/{resume-button,resume-dialog}.tsx` |
| `onboarding-quiz` | `components/quiz/*` (9 files plus CSS module), `quiz-reward-banner.tsx` |
| `claim-reward` | `app/subscription/_components/reward-banner.tsx` (uses an auth action today) |

**`client/widgets`:**

| Slice | From |
|---|---|
| `sidebar` | `app-sidebar.tsx`, `sidebar-history.tsx` (381 lines; split list/pagination), `sidebar-toggle.tsx`, `sidebar-user-nav.tsx` |
| `chat-window` | `chat.tsx` (349), `chat-header.tsx`, `greeting.tsx` |
| `message-list` | `messages.tsx`, `message.tsx` (529; split into a parts renderer and an actions row), `hooks/use-messages.tsx` |
| `composer` | `multimodal-input.tsx` (517) as the composition of the features above |
| `marketing-shell` | `landing/landing-nav.tsx`, `landing/landing-footer.tsx`, `landing/cta-section.tsx` (shared by landing, models and blog) |
| `account-nav` | `account-page-top-nav.tsx`, `subscription/_components/subscription-top-nav.tsx`, `manage/_components/manage-top-nav.tsx` (three near-duplicates; consolidate) |
| `auth-layout` | `auth-page-layout.tsx`, `auth-page-header.tsx` |
| `usage-report` | `token-usage-summary.tsx`, `token-history-table.tsx` |

**`client/pages`** (each `ui/` plus `index.ts`; RSC-friendly, data passed in as props):
`landing` (landing sections: hero, features, pricing, faq, how-it-works, benefits, trust-bar, pain-points, demo-showcase, hero-video, chat-mockup, webmcp-tools) · `models-catalog` (`components/models/*`) · `model-landing` (`components/models/landing/*`) · `blog-index` · `blog-post` · `blog-preview` (`components/blog/preview/*`) · `legal` (offer, privacy, requisites, support) · `login` · `register` · `forgot-password` · `reset-password` · `verify-email` · `chat` · `projects` · `project-detail` · `prompts` (`prompt-library.tsx`, `prompt-detail-modal`) · `balance` (`app/subscription/page.tsx` UI plus `_components/{balance-hero,free-side-card,plan-card,plans-grid-card,status-banner,subscription-header,icons}`, `dashboard.module.css`) · `subscription-manage` · `usage` · `plans` (`app/(auth)/manage-subscription/*` UI: faq, plan-card-full, trust-row) · `not-found` / `error`.

[inf] Landing sections and model-landing blocks are used by a single page each, so FSD allows them to stay inside the page slice; they do not need to be widgets. Only nav, footer and CTA are shared across pages, which is why `marketing-shell` is a widget.

**`client/app`** (FSD app layer, no slices):
- `providers/`: the chat provider stack today is `SessionProvider → DataStreamProvider → ModelProvider → ProjectProvider → WebSearchProvider → SidebarProvider`, from `app/(chat)/layout.tsx`. It moves here as `ChatProviders`.
- `styles/globals.css`
- `analytics/` (`yandex-metrika.tsx`, `utm-capture.tsx`)
- `error-logger.tsx`
- `dom-mutation-guard.tsx`. Keep it; CLAUDE.md gotcha 12 explains why.

### 3.3 Mapping table: old path to new path

**Root of `components/` (file level)**
| Old | New |
|---|---|
| account-page-top-nav.tsx | client/widgets/account-nav/ui/account-top-nav.tsx |
| app-sidebar.tsx | client/widgets/sidebar/ui/app-sidebar.tsx |
| assistant-icon.tsx | client/entities/model/ui/assistant-icon.tsx |
| auth-form.tsx | client/features/auth/ui/auth-form.tsx |
| auth-page-header.tsx | client/widgets/auth-layout/ui/auth-page-header.tsx |
| auth-page-layout.tsx | client/widgets/auth-layout/ui/auth-page-layout.tsx |
| cancellation-feedback-dialog.tsx | **delete** (orphan), or client/features/cancel-subscription/ui/ |
| chat-header.tsx | client/widgets/chat-window/ui/chat-header.tsx |
| chat.tsx | client/widgets/chat-window/ui/chat-window.tsx |
| data-stream-provider.tsx | client/entities/message/model/data-stream.tsx |
| dom-mutation-guard.tsx | client/app/dom-mutation-guard.tsx (logic: shared/lib/dom) |
| entity-gallery.tsx | split: client/features/manage-projects/ui/* + client/entities/project/ui/* |
| error-logger.tsx | client/app/error-logger.tsx |
| greeting.tsx | client/widgets/chat-window/ui/greeting.tsx |
| icons.tsx | client/shared/ui/icons/* (split) |
| message-actions.tsx | client/features/message-actions/ui/message-actions.tsx |
| message-attachments.tsx | client/entities/message/ui/message-attachments.tsx |
| message-editor.tsx | client/features/edit-message/ui/message-editor.tsx |
| message.tsx | client/widgets/message-list/ui/message.tsx (split) |
| messages.tsx | client/widgets/message-list/ui/message-list.tsx |
| model-badge.tsx | client/entities/model/ui/model-badge.tsx |
| multimodal-input.tsx | client/widgets/composer/ui/composer.tsx (split into features) |
| password-input.tsx | client/shared/ui/password-input.tsx (validation from core) |
| payment-loading-overlay.tsx | client/features/subscribe/ui/payment-loading-overlay.tsx |
| project-detail.tsx | client/pages/project-detail/ui/project-detail-page.tsx |
| project-manager.tsx | client/pages/projects/ui/projects-page.tsx |
| route-error-fallback.tsx | client/shared/ui/route-error-fallback.tsx |
| sidebar-history-item.tsx | client/entities/chat/ui/chat-list-item.tsx |
| sidebar-history.tsx | client/widgets/sidebar/ui/sidebar-history.tsx |
| sidebar-toggle.tsx | client/widgets/sidebar/ui/sidebar-toggle.tsx |
| sidebar-user-nav.tsx | client/widgets/sidebar/ui/sidebar-user-nav.tsx |
| sign-out-form.tsx | **delete** (orphan, server import) |
| submit-button.tsx | client/shared/ui/submit-button.tsx |
| suggested-actions.tsx | **delete** (orphan) |
| support-link.tsx | client/shared/ui/support-link.tsx |
| toast.tsx | client/shared/ui/toast.tsx |
| token-history-table.tsx | client/widgets/usage-report/ui/token-history-table.tsx |
| token-usage-summary.tsx | client/widgets/usage-report/ui/token-usage-summary.tsx |
| tool-run-renderer.tsx | client/entities/message/ui/tool-run-renderer.tsx (split) |
| url-extract-input-preview.tsx, url-extract-result.tsx, web-search-input-preview.tsx, web-search-result.tsx | **delete** (orphans), or entities/message/ui if revived |
| usage-limits-widget.tsx, video-player.tsx | **delete** (orphans) |
| utm-capture.tsx | client/app/analytics/utm-capture.tsx |
| yandex-metrika.tsx | client/app/analytics/yandex-metrika.tsx |

**Subfolders of `components/`**
| Old | New |
|---|---|
| blog/{article-view,article-content,blog-image,post-card}.tsx | client/entities/blog-post/ui/ |
| blog/{blog-index,blog-cta}.tsx | client/pages/blog-index/ui/ |
| blog/preview/* | client/pages/blog-preview/ui/ (+ model/draft.ts) |
| composer/* | features: attach-files, model-select (think-popover), media-settings, web-search-toggle, project-select, spend-warning, send-message (keyboard-hints); see §3.2 |
| elements/{actions,code-block,conversation,loader,message,prompt-input,source,suggestion}.tsx | client/shared/ui/ai-elements/ |
| elements/{response,tool-run,document-preview,media-preview,media-preview-styles,media-lightbox,media-lightbox-provider,media-stopped-card}.tsx | client/entities/message/ui/ |
| elements/media-stop-button.tsx | client/features/stop-generation/ui/ |
| elements/{branch,context,image,inline-citation,task,tool,usage-hint,web-preview}.tsx | **delete** (orphans) |
| icons/logos.tsx + icons/logos/*.svg | client/entities/model/ui/provider-logo/ (SVGR rule is glob-based, unaffected) |
| landing/{landing-nav,landing-footer,cta-section}.tsx | client/widgets/marketing-shell/ui/ |
| landing/fade-in.tsx | client/shared/ui/fade-in.tsx |
| landing/* (rest) | client/pages/landing/ui/ |
| models/* | client/pages/models-catalog/ui/ (model-card can go to entities/model/ui if reused) |
| models/landing/* | client/pages/model-landing/ui/ |
| prompt-library/{prompt-card,prompt-placeholders}.tsx | client/entities/prompt/ui/ |
| prompt-library/{prompt-filter-tabs,prompt-pager}.tsx | client/features/prompt-filter/ui/ |
| prompt-library/{prompt-library,prompt-detail-modal}.tsx | client/pages/prompts/ui/ |
| quiz/* (+ quiz-wizard.module.css) | client/features/onboarding-quiz/{ui,model}/ (`types.ts`, `use-wizard.ts`, `onboarding-quiz.ts` go to model) |
| styles-projects/editor-v1.tsx | client/features/edit-project/ui/ (split) |
| ui/* (shadcn) | client/shared/ui/ (keep flat for the shadcn CLI) |
| ui/model-selector/* | client/features/model-select/ui/ (+ model/use-model-selector.ts) |
| ui/model-dot.tsx | client/entities/model/ui/model-dot.tsx |

**`hooks/` and `contexts/` (file level)**
| Old | New |
|---|---|
| hooks/use-auto-resume.ts | client/features/resume-stream/model/use-auto-resume.ts |
| hooks/use-chat-stop.ts | client/features/send-message/model/use-chat-stop.ts |
| hooks/use-double-click-zoom-toggle.ts | client/shared/lib/hooks/use-double-click-zoom-toggle.ts |
| hooks/use-is-mac.ts | client/shared/lib/hooks/use-is-mac.ts |
| hooks/use-media-download.ts | client/features/download-media/model/use-media-download.ts |
| hooks/use-messages.tsx | client/widgets/message-list/model/use-messages.ts |
| hooks/use-mobile.ts | client/shared/lib/hooks/use-mobile.ts (shadcn-owned; biome ignore moves too) |
| hooks/use-scroll-to-bottom.tsx | client/shared/lib/hooks/use-scroll-to-bottom.ts |
| hooks/use-spend-banner.ts | client/features/spend-warning/model/use-spend-banner.ts |
| contexts/model-context.tsx (386) | client/features/model-select/model/model-provider.tsx + client/features/media-settings/model/* |
| contexts/project-context.tsx | client/features/project-select/model/project-provider.tsx |
| contexts/web-search-context.tsx | client/features/web-search-toggle/model/web-search-provider.tsx |

**UI colocated under `app/`**
| Old | New |
|---|---|
| app/(auth)/{login,register}/*-page-client.tsx | client/pages/{login,register}/ui/ (form from features/auth) |
| app/(auth)/{forgot,reset}-password/page.tsx (client pages) | the route file stays thin; UI goes to client/pages/{forgot-password,reset-password}/ui |
| app/(auth)/manage-subscription/{components,hooks,utils}/* | client/pages/plans/ui + client/features/subscribe/{model,lib} + client/entities/subscription/ui (plan-icons) |
| app/subscription/_components/* | client/pages/balance/ui (balance-hero, free-side-card, plan-card, plans-grid-card, status-banner, subscription-header, icons, dashboard.module.css), client/features/top-up/*, client/features/onboarding-quiz (quiz-reward-banner), client/features/claim-reward (reward-banner), client/entities/transaction (transaction-history-card), client/widgets/account-nav (subscription-top-nav) |
| app/subscription/manage/_components/* | client/pages/subscription-manage/ui (manage-header, manage-footer-strip, tariff-card, payment-method-card, cancelled-banner, manage-types), client/features/{cancel,resume}-subscription, client/entities/transaction (payment-history-card), client/widgets/account-nav (manage-top-nav) |
| app/subscription/verify-email/_components/* + verify-email.module.css | client/features/auth/ui/verify-email/* |
| app/globals.css | client/app/styles/globals.css (fix `@source` relative path, `app/globals.css:4`) |
| app/(chat)/layout.tsx provider stack | client/app/providers/chat-providers.tsx; cookie parsing for initial model settings goes to server (`/v1/me/preferences`) or core helpers |

**Client-side `lib/` and data**
| Old | New |
|---|---|
| lib/client-logger.ts, lib/client-diagnostics.ts | client/shared/lib/logger/ |
| lib/download.ts | client/shared/lib/download.ts |
| lib/dom/dom-mutation-guard.ts | client/shared/lib/dom/ |
| lib/url.ts | client/shared/lib/url.ts |
| lib/utils.ts | split: client/shared/lib/cn.ts (`cn`), client/shared/api/http.ts (`fetcher`, `fetchWithErrorHandlers`), core/lib/uuid.ts, server mapper (`convertToUIMessages`) |
| lib/utils/swatch.ts | client/features/edit-project/lib/ |
| lib/utils/format-billing.ts | core/billing/ (check its importers) |
| lib/chat/input-draft.ts | client/features/send-message/lib/ |
| lib/media/*, lib/messages/group-tool-runs.ts, lib/attachments/attachment-display.ts | client/entities/message/lib/ |
| lib/attachments/attachment-limits.ts | core/attachments/ (server validates uploads too) |
| lib/ai/{model-capability,model-speed,entitlements}.ts | client/entities/model/lib/. Note: entitlements is "UI visibility" per CLAUDE.md; if the server also gates on it, put it in core. |
| lib/ai/models.ts | core/ai/models.ts, then split: registry data (core) vs cookie parsing (client/features/model-select/lib) vs gateway provider-option types (server) |
| lib/i18n/{dictionary,format,translate,errors}.ts | core/i18n/ |
| messages/ru.json, ru.errors.json | core/i18n/messages/ (fix the relative imports at `lib/i18n/dictionary.ts:1-2`, `lib/i18n/errors.ts:1`, `lib/ai/__tests__/model-registry.test.ts:3`; also the `readFileSync` path in `lib/i18n/__tests__/translate.test.ts:10`) |
| lib/payments/cloudpayments-widget.ts | client/features/top-up/lib/ (also used by subscribe, so it may be client/shared/lib/cloudpayments) |
| lib/prompts/prompt-meta.ts | client/entities/prompt/lib/ |
| lib/styles-projects/templates.ts | client/entities/project/lib/ |
| lib/validation/password.ts | core/validation/ (the server should validate passwords with the same rule) |
| lib/marketing/{hero-media,landing-links}.ts | client/pages/landing/config/ |
| lib/marketing/{landing-content,models-catalog,model-landings/*}.ts | core/marketing/ (used by RSC pages and the agent-markdown route) |
| lib/blog/{format,slug}.ts | client/entities/blog-post/lib/; frontmatter/schema/reading-time go to core/blog/ |
| lib/agent-discovery/webmcp-tools.ts | client/app/webmcp/ (registered from the marketing layout); constants go to core |
| lib/subscription/use-cancel-subscription.ts | **delete** (orphan) |
| lib/types.ts (ChatMessage etc.) | contract/chat (see V2) |
| types/*.d.ts | src/types/ |
| public/, content/, assets/ | stay at the root (`process.cwd()` reads in `lib/blog/posts.ts:14`, `lib/ai/pdf-fonts.ts:18`, `lib/ai/watermark.ts:10`) |

### 3.4 Server Components that fetch data
Today [obs]:
- Route pages call `auth()` and DB queries directly: `app/(chat)/chat/[id]/page.tsx` (`get-chat-by-id`, `get-messages-by-chat-id`), `projects/[id]/page.tsx`, `subscription/page.tsx` (`getBalance`, `priceForCurrency`, `getQuizResponse`, `spend`), `subscription/manage/page.tsx`, `verify-email/page.tsx`, the blog pages (`lib/blog/posts.ts`, `server-only`).
- One *component* does too (V6).

Recommended [inf]:
1. **Only `src/app/**/page.tsx` and `layout.tsx` load data.** Pattern, about 20-40 lines per file:
   ```ts
   // src/app/(chat)/chat/[id]/page.tsx  (Server Component)
   import { notFound, redirect } from "next/navigation";
   import { ChatPage } from "@/client/pages/chat";
   import { createServerApi } from "@/server/…/server-client"; // in-process oRPC client
   export default async function Page({ params }: PageProps<"/chat/[id]">) {
     const api = await createServerApi();          // context from request headers/cookies
     const chat = await api.v1.chat.get({ id: (await params).id }).catch(mapToNotFound);
     return <ChatPage chat={chat} />;
   }
   ```
   - The in-process client is `createRouterClient(router, { context })`. It exists in @orpc/server 1.15.7 (`admin-dashboard/node_modules/@orpc/server/dist/index.d.mts:797`).
   - It runs the same validation, auth middleware and output DTO shaping that mobile gets over HTTP, with no network hop. This is why it beats both direct service calls (which bypass the contract) and `fetch("/api/v1/…")` (an extra network hop plus cookie forwarding).
   - Using it in RSC is **UNVERIFIED against oRPC docs**. Only the type signature was verified. The server research owns the context factory.
2. **Page slices in `src/client/pages/*` are pure.** A page slice's root component may be an RSC (no `"use client"`), but it receives data through props and never imports `@/server`. That makes FSD's `index.server.ts` mostly unnecessary here. Keep it as an escape hatch only.
3. **Client-side fetching** (SWR today: `sidebar-history.tsx:119`, `chat.tsx:242`, `prompt-library.tsx:29`, `token-*`, `usage-hint`, `use-spend-banner`, and about 15 raw `fetch("/api/…")` calls) moves into the `api` segments of entities and features, using the typed oRPC client in `shared/api`.
   - [inf] Decide on SWR or TanStack Query once. The owner's admin-dashboard uses `@orpc/tanstack-query`, which favours TanStack. Either way the query hooks live in `entities/*/api`, never in `ui`.
4. **Static marketing and blog content** stays RSC-rendered from `core/marketing` data (no API needed). Blog files are read by the route file through a server module and passed as props.

### 3.5 Barrels, the RSC boundary and tree-shaking
- **Lint conflict [obs]:** ultracite sets `performance/noBarrelFile: "error"` (`node_modules/ultracite/biome.jsonc:454`), and the repo already suppresses it once (`lib/subscription/billing-periods/index.ts:1`). FSD slice indexes are barrels by definition.
  - Recommendation: add a `biome.jsonc` override that turns `noBarrelFile` off only for `src/client/{pages,widgets,features,entities}/*/index.ts`.
  - Do **not** add an index to `shared/ui` or `shared/lib` (FSD itself advises per-module imports there), and keep the rule on everywhere else.
  - Turn on `performance/noReExportAll` (ultracite has it off, line 473) for `src/client/**`, matching FSD's no-`export *` rule.
- **RSC boundary [inf]:**
  - `"use client"` is per module. An `index.ts` that re-exports a client component is not itself a client module, so an RSC route can import a slice index that mixes RSC and client components.
  - The dangerous direction is the reverse: an index re-exporting a `server-only` module, imported from client code, fails the build. The rule "client never imports server" removes that.
  - Inside a slice, use relative imports only; FSD advises this too, and it avoids index cycles.
- **Tree-shaking:** keep slice indexes small and explicit (named re-exports, `export type` for types). Whether Turbopack drops unused re-exports from local barrels in client chunks is **UNVERIFIED**; `optimizePackageImports` is documented for packages, not local folders.
  - Mitigation: measure the chat route's client JS before and after the move with `next build` output.
  - Watch `ru.json` (128 KB), which `lib/i18n/dictionary.ts:2` already ships to every client chunk that uses `useTranslations`. That is unrelated to barrels but the biggest bundle item in this area.

---

## 4. Tooling impact

| File | Today [obs] | Change [inf] |
|---|---|---|
| `tsconfig.json:24-26` | `"@/*": ["./*"]` | `"@/*": ["./src/*"]`. TypeScript 5.8 picks the longest-prefix pattern (`findBestPatternMatch`, `node_modules/typescript/lib/typescript.js:3638-3650`), so extra layer aliases could be added later safely, but they are not needed. |
| `tsconfig.json:28-35` | `include: ["**/*.ts", "**/*.tsx", …]`, `exclude: ["node_modules"]`. This picks up `.claude/worktrees/**` (7,790 TS files there); the memory notes that stale worktrees break `pnpm check`. | `include: ["src/**/*", "scripts/**/*", "tests/**/*", "*.ts", ".next/types/**/*.ts", …]` |
| `components.json:7,13-17` | css `app/globals.css`; aliases components/utils/ui/lib/hooks under `@/components`, `@/lib`, `@/hooks` | css `src/client/app/styles/globals.css`; `ui: "@/client/shared/ui"`, `utils: "@/client/shared/lib/cn"` (shadcn imports `cn` from this alias), `lib: "@/client/shared/lib"`, `hooks: "@/client/shared/lib/hooks"`, `components: "@/client/shared/ui"`. Exact `utils` semantics in the shadcn CLI are **UNVERIFIED**; test `npx shadcn add` in a branch. |
| `biome.jsonc:4-10` | ignores `!components/ui`, `!lib/utils.ts`, `!hooks/use-mobile.ts` | Point the ignores at the new shadcn paths only (keep model-selector **out** of the ignore); add `overrides` for barrels and boundaries (below). |
| `vitest.config.ts:6-12` | `environment: "node"`, include `**/__tests__/**/*.test.ts`, alias `"@": resolve(".")` | alias `"@": resolve(__dirname, "src")`; include `src/**/__tests__/**/*.test.{ts,tsx}` and `scripts/**/__tests__/**/*.test.ts` (which also stops it scanning `.claude/worktrees`). For component tests add per-file `// @vitest-environment jsdom` plus `@testing-library/react` and `jsdom` (not installed; versions **UNVERIFIED**). |
| `playwright.config.ts:26,58,65,103` | testDir `./tests`, projects e2e/routes, webServer `pnpm dev` | No path change. Tests use page URLs, not source imports (`tests/*.ts` have no `@/` imports). |
| `next.config.ts` turbopack rule `"*.svg"` | glob, path-agnostic | Unchanged. |
| `next.config.ts` `HTML_PAGE_SOURCE` `/((?!api/\|_next/\|images/\|videos/).*)` | Link headers on everything except `/api/…` | Unchanged if REST stays under `/api/v1`. **If the server research mounts at `/v1/…`, this regex (and `proxy.ts` matchers) must exclude it.** |
| `next.config.ts` `outputFileTracingIncludes` | `./public/...`, `./assets/fonts/...`, `./content/blog/**` keyed by route `/api/chat`, `/blog`, … | Unchanged (root data folders stay; keys are routes). Re-key if the chat route path changes. |
| `next.config.ts` `experimental.serverActions.allowedOrigins` | present | Remove when the last server action is gone (end of API migration). |
| `app/globals.css:4` | `@source '../node_modules/streamdown/dist/index.js'` | becomes `'../../../../node_modules/…'` from `src/client/app/styles/` |
| `package.json` scripts `build` (`tsx lib/db/migrate`), `db:migrate` | root `lib/` paths | becomes `src/server/db/migrate.ts` (or wherever the server research puts the DB) |
| `drizzle.config.ts:4-5` | `./lib/db/schema.ts`, `./lib/db/migrations` | new server paths |
| `scripts/hooks/protected-paths.mjs:34` | `/^lib\/db\/migrations\/(?!meta\/_journal\.json$)/` | update to the new migrations path in the **same commit** as the move, or the protection silently lapses. Its tests are in `scripts/hooks/__tests__`. |
| `scripts/check.ts` | no source paths (only `next-env.d.ts`, `tsconfig.tsbuildinfo`) | add a boundaries step (see below) |
| `proxy.ts`, `instrumentation.ts` | root | move to `src/` [doc] |
| `CLAUDE.md` | about 40 path references (`lib/ai/models.ts`, `components/dom-mutation-guard.tsx`, `messages/ru.json`, …) | rewrite the Architecture section; add a "where files live" table (§6) |
| `.claude/agents/review.md:83,137,189,219,246,270,323` | path-scoped review checklists | update the paths |
| `.cursor/rules/*.mdc`, `docs/agent-discovery.md` | path references | update; `docs/plans/*` are history, leave them |
| `.claude/skills/repo-recipes/SKILL.md` | **does not exist in this checkout**: `.gitignore:57-59` ignores `.claude/*` except `settings.json` and `commands/` | CLAUDE.md points at a missing file. Either commit the skill (adjust .gitignore) or drop the reference. The recipes must be rewritten for the new layout anyway. |

### 4.1 Can boundaries be enforced?
**Biome 2.2.2 (installed, already in `pnpm check`)** [doc + obs]:
- `style/noRestrictedImports` supports `paths` and, from v2.2.0, `patterns: [{ group: [gitignore-style globs, "!negation"], message, importNamePattern }]`.
  - Verified in `node_modules/@biomejs/biome/configuration_schema.json`: `NoRestrictedImportsOptions`, `PatternOptions`.
  - Documented at biomejs.dev/linter/rules/no-restricted-imports.
  - ultracite already enables it at `error` (`ultracite/biome.jsonc:517`).
  - Patterns match the specifier as written, so alias imports (`@/client/...`) are matchable. **Relative imports escaping a slice are not caught**; ban `../../` across slices with a pattern such as `"../../*"` inside slices. Whether it matches relative specifiers that way is **UNVERIFIED**.
- `overrides[].includes` plus `linter.rules` scopes rules by folder (the `OverridePattern` schema has `includes` and `linter`; verified).
- Also available: `correctness/noPrivateImports` (JSDoc `@public/@private/@package` visibility; ultracite has it off) and `nursery/noImportCycles` (ultracite has it off). Turning `noImportCycles` on is cheap insurance; there are no cycles today.

Sketch (UNVERIFIED glob semantics for `*` vs `**` in `group`; test in a branch):
```jsonc
"overrides": [
  { "includes": ["src/client/{pages,widgets,features,entities}/*/index.ts"],
    "linter": { "rules": { "performance": { "noBarrelFile": "off" } } } },
  { "includes": ["src/client/**"],
    "linter": { "rules": { "performance": { "noReExportAll": "error" },
      "style": { "noRestrictedImports": { "level": "error", "options": { "patterns": [
        { "group": ["@/server/**", "@/app/**"], "message": "Client code must not import server or route code; use the API client (shared/api)." },
        { "group": ["@/client/*/*/*", "@/client/*/*/*/**", "!@/client/shared/**"],
          "message": "Import a slice through its public API (index.ts), not its internals." } ] } } } } },
  { "includes": ["src/client/shared/**"], "linter": { "rules": { "style": { "noRestrictedImports": { "level": "error",
      "options": { "patterns": [{ "group": ["@/client/{app,pages,widgets,features,entities}/**"], "message": "shared is the lowest layer" }] } } } } },
  { "includes": ["src/client/entities/**"], /* forbid features|widgets|pages|app */ },
  { "includes": ["src/client/features/**"], /* forbid widgets|pages|app */ },
  { "includes": ["src/client/widgets/**"], /* forbid pages|app */ },
  { "includes": ["src/client/pages/**"],   /* forbid app */ },
  { "includes": ["src/server/**"], /* forbid @/client/** and @/app/** */ },
  { "includes": ["src/core/**", "src/contract/**"], /* forbid @/client/**, @/server/**, @/app/**, react, next */ }
]
```
- **Gap:** "features/a must not import features/b" needs either one override per slice, which a script can generate and which is noisy, or a custom check.
  - Recommendation [inf]: add `scripts/check-boundaries.ts`, about 60 lines and reusing the approach of the scratchpad `tools/graph.mjs`, as a `scripts/check.ts` step and a vitest test.
  - It covers same-layer cross-slice imports, `@x` exceptions, and relative imports that escape a slice. Biome covers the layer direction.
- Whether Biome *overrides merge* rule options with the base `noRestrictedImports` config or replace them is **UNVERIFIED**. If they replace, the ultracite-level config is empty anyway, so this is low risk.

**Steiger** [doc: github.com/feature-sliced/steiger]:
- A standalone CLI (`npx steiger ./src`) with `steiger.config.ts` in flat-config style and `@feature-sliced/steiger-plugin` rules (`fsd/forbidden-imports`, `fsd/no-public-api-sidestep`, `fsd/public-api`, `fsd/insignificant-slice`, `fsd/no-segmentless-slices`, …).
- It is beta, latest 0.5.x per the README, needs no ESLint, and is **not installed**.
- [inf] Optionally run it in CI as `steiger ./src/client`: it covers cross-slice and sidestep rules out of the box. Do not make it a hard gate until its beta status settles.
- Whether it treats `src/client/{app,pages}` correctly when run with `./src/client` as root, and whether `insignificant-slice` fires on single-use slices, is **UNVERIFIED**.

---

## 5. Migration mechanics

**Principle:** each step is one PR (or one commit inside a domain PR). It is a pure move plus an import rewrite, with no behaviour change, and `pnpm check` (typecheck, Biome, vitest, build) stays green. Behaviour changes, such as swapping a server action or fetch for oRPC, go in separate commits.

**Tooling for moves [inf]:**
- `git mv` keeps history.
- A small `scripts/codemods/rewrite-imports.ts`, run once per step and not committed long-term (or kept under `scripts/codemods/`):
  - It takes a JSON map `oldModulePath → newModulePath`.
  - It rewrites `@/…` specifiers in all `src/**`, `tests/**` and `scripts/**` files, and recomputes relative specifiers for moved files.
  - Then `pnpm format` re-sorts imports (Biome organizeImports).
- `ts-morph` is not installed; plain regex over import specifiers is enough here, because every import is a static string (verified by the graph builder: no unresolved `@/` targets were reported).
- **No re-export shims.** They would trip `noBarrelFile`, keep dead paths alive, and the codebase has no external consumers.

**Order:**

| Phase | Content | Risk |
|---|---|---|
| 0 | Atomic `src/` move of `app components hooks contexts lib types messages proxy.ts instrumentation.ts`; alias set to `./src/*`; fix relative escapes (globals.css `@source`, i18n JSON imports, drizzle, package scripts, protected-paths, components.json, biome ignores, vitest alias/include, tsconfig include). No import edits otherwise. | Medium: `src/app` is ignored if any root `app/` remains [doc]. Verify with `pnpm build` and the Playwright route project. Do it on a quiet day; rebase pain for open branches. |
| 1 | Delete orphans (§2.6) and V5/V8. | Low. Grep for dynamic and string usage first. |
| 2 | Create `src/client/shared` (ui, lib, api, config), `src/core`, `src/types`; move shadcn plus ai-elements, split `icons.tsx`, split `lib/utils.ts`. Update components.json and the biome shadcn ignores. | Low-medium: about 150 importers of `components/ui/*` and `lib/utils` are rewritten (mechanical). |
| 3 | Entities: model, message (+ data-stream), chat, prompt, project, subscription, balance, transaction, blog-post, user. Introduce contract DTO types here (V1/V2) if the contract exists; otherwise temporarily re-export the DB types from `entities/*/model` so the swap later is a one-file change. | Medium: V2 (`ChatMessage`) touches about 15 files. |
| 4 | Features, one domain at a time, ideally paired with that domain's oRPC endpoint (e.g. "prompts": server/v1/prompts + entities/prompt + features/prompt-favorite + pages/prompts). Contexts become feature providers; server actions are replaced in a following commit. | Medium-high for model-select (`model-context` 386 lines + `models.ts` 2,252). |
| 5 | Widgets: sidebar, composer, message-list, chat-window, marketing-shell, account-nav, auth-layout, usage-report. | **Highest: the chat cluster** (`chat.tsx`, `messages.tsx`, `message.tsx`, `multimodal-input.tsx`, `tool-run-renderer.tsx`, `elements/media-*`, `hooks/use-auto-resume`, `use-chat-stop`, `data-stream-provider`). Move the files first (pure), split them in a later PR. Re-run `tests/e2e/chat-input.test.ts` and manual resume, stop and media checks. Watch the GIPITI-101 DOM-guard behaviour. |
| 6 | Pages: each `src/app/**/page.tsx` shrinks to guard + load + `<XPage/>`; `_components` folders disappear from `src/app`. | Low-medium; per route. |
| 7 | App layer: providers, styles, analytics; then turn the boundary rules from `warn` to `error`; enable `noImportCycles`; add the steiger CI job (optional). | Low. |

**Ratchet:** enable the Biome boundary overrides in Phase 2 at `"warn"` for not-yet-migrated folders, and switch each layer to `"error"` as soon as it is complete. The graph check in `scripts/check.ts` can carry an allowlist file of the remaining violations that may only shrink. That gives the solo developer a visible burn-down.

**Biggest risk spots:**
- The chat cluster (above).
- `lib/ai/models.ts`: 2,252 lines, isomorphic, imports `@ai-sdk/google` types, and is used by server, client, layout cookie parsing and the marketing catalog. Move it whole to `core/ai/models.ts` in Phase 0/2; split it only later.
- `contexts/model-context.tsx`: state, cookies through server actions, and media settings in one file.
- `components/icons.tsx`: 1,256 lines and 15 importers.
- `entity-gallery.tsx` (692) and `styles-projects/editor-v1.tsx` (663).
- The three near-identical account top-navs.
- The CSS modules shared across components (`dashboard.module.css` is used by `page.tsx`, `plan-card`, `plans-grid-card`); they must move together.

No cyclic imports exist today, so ordering is not constrained by cycles.

---

## 6. Where every kind of file lives

| Kind of file | Location |
|---|---|
| Next route files (page, layout, route, error, not-found, loading, sitemap, manifest, robots, opengraph-image, .well-known) | `src/app/**` (thin) |
| Page composition (RSC or client) | `src/client/pages/<page>/ui`, `index.ts` |
| Reusable UI blocks composed of features/entities | `src/client/widgets/<widget>/ui` |
| User actions with their own state or API call | `src/client/features/<feature>/{ui,model,api,lib}` |
| Business-object display, query hooks, DTO re-exports | `src/client/entities/<entity>/{ui,model,api,lib}` |
| shadcn primitives, ai-elements kit, icons | `src/client/shared/ui/*` (one file per component, no root index) |
| Generic client utilities and hooks | `src/client/shared/lib/*` |
| oRPC client, query client | `src/client/shared/api/*` |
| Providers, global CSS, analytics, error logging, DOM guard | `src/client/app/*` |
| CSS modules | next to the component that owns them |
| i18n dictionaries and translate | `src/core/i18n` (`messages/*.json` inside) |
| Model registry, money, billing constants, validation, marketing content | `src/core/*` |
| API contract, DTOs, error codes | `src/contract/*` |
| API routers, services, DB, integrations | `src/server/*` (server research) |
| Unit tests | `__tests__/` next to the code (`*.test.ts`; `*.test.tsx` once jsdom is added) |
| E2E and route tests | `tests/e2e`, `tests/routes` (unchanged) |
| Ambient types | `src/types/*.d.ts` |
| Static files, blog markdown, fonts and video | `public/`, `content/`, `assets/` (root) |

**Client test coverage [inf]**, for the test-plan author:
1. Keep business logic out of `ui` so it stays testable in the node environment (`model/` and `lib/` segments, `__tests__/*.test.ts`).
2. Add a boundary test, the graph check, so the structure cannot regress.
3. Add jsdom and Testing Library for a handful of high-value component tests: composer submit/stop, model-select, top-up dialog stages, auth forms against a mocked oRPC client.
4. Keep Playwright for the chat stream, resume and payments flows. Add one e2e smoke test per migrated page in Phase 6.

---

## 7. UNVERIFIED claims
1. Next.js does not treat `src/client/pages` as a Pages Router directory. The docs only mention root and `src/pages`; not tested in a build.
2. Turbopack resolves overlapping tsconfig `paths` with the same longest-prefix rule as tsc. The tsc behaviour is verified; Turbopack's is not.
3. Turbopack tree-shakes unused re-exports from local slice `index.ts` barrels in client chunks.
4. An `error.tsx` route file can simply re-export a `"use client"` component from a page or shared slice without its own `"use client"` directive.
5. Biome `noRestrictedImports` `patterns.group` glob semantics: how `*` vs `**` work with `@/` alias specifiers, whether relative specifiers like `../../*` match as written, and whether options in `overrides` merge or replace.
6. Steiger 0.5.x behaviour on this layout (`./src/client` as root, canonical vs `_app`/`_pages` names, the `insignificant-slice` noise). The FSD guide says the `_app`/`_pages` naming is compatible with Steiger; the README did not mention Next naming.
7. The shadcn CLI honours `components.json` `aliases.utils` pointing at `@/client/shared/lib/cn` (a non-`utils` filename).
8. Using `createRouterClient` from React Server Components with a request-derived context. Only the type signature in @orpc/server 1.15.7 was verified; the usage pattern and context factory are for the server research to confirm against the oRPC docs.
9. Versions and setup for `@testing-library/react`, `jsdom`/`happy-dom` with vitest 4.1 (none are installed).
10. The orphan list is from static analysis only. Dynamic imports or string references were not exhaustively ruled out; `components/ui/*` orphans are shadcn and harmless.
11. `lib/utils/format-billing.ts` and `lib/ai/entitlements.ts`: final placement (core vs client) depends on server-side use that I did not trace beyond the API, server-only and server-action roots.
