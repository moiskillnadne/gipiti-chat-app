---
date: 2026-10-18
status: done
branch: claude/optimistic-antonelli-7d5781
---

# Indexes for period analytics on Message_v2, Chat and Transaction

## Goal

The read-only admin dashboard (`../admin-dashboard`, see its
`docs/gipiti-analysis.md`, "Indexes summary" and "Decisions recommended") runs period
queries that today are sequential scans: `"Message_v2"` has no indexes beyond the PK
(filtered by `"createdAt"`, joined through `"chatId"` to `"Chat"."userId"`, also
unindexed), and `"Transaction"` has no index leading with `created_at` for the
`type = 'usage_debit' AND created_at range` filter. The dashboard must never migrate the
DB, so the indexes belong here.

## Files that change

- `lib/db/schema.ts` — index definitions on `chat`, `message`, `transaction`
- `lib/db/migrations/0044_period_query_indexes.sql` — hand-written (`pnpm db:generate` is
  broken)
- `lib/db/migrations/meta/_journal.json` + `meta/0044_snapshot.json`

## Indexes

| Index | Columns | Why |
|---|---|---|
| `chat_user_created_idx` | `"Chat" ("userId", "createdAt")` | join target for analytics; also the sidebar chat list (`userId = ? ORDER BY createdAt DESC` with cursors) |
| `message_v2_chat_created_idx` | `"Message_v2" ("chatId", "createdAt")` | join source; also `getMessagesByChatId` (ordered) and delete-after-timestamp |
| `message_v2_created_at_idx` | `"Message_v2" ("createdAt")` | global period range with no chat in the predicate |
| `transaction_type_created_idx` | `"Transaction" (type, created_at)` | `type = 'usage_debit' AND created_at range`; `(user_id, created_at)` cannot serve a global range |

The doc suggested single-column `("chatId")` and `("userId")`; the composites with
`createdAt` serve the same equality lookups and additionally cover the app's own ordered
reads, at the cost of a slightly wider index.

## Risks

- The Drizzle migrator (`lib/db/migrate.ts`) runs each migration in a transaction, so
  `CREATE INDEX CONCURRENTLY` is not possible. Plain `CREATE INDEX IF NOT EXISTS` takes a
  SHARE lock per table (reads OK, writes wait) for the build. At ~13k messages / ~5k
  transactions that is sub-second, but apply during low traffic.
- `pnpm build` runs migrations first, so the next production deploy applies them.

## Verification

- `pnpm check` (typecheck, Biome, unit tests, build with placeholder env; never touches
  the DB).
- Snapshot/journal consistency checked by hand against `0043`.
