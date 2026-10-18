---
date: 2026-10-18
status: done
branch: feat/user-activity-day
---

# User activity day table and write path


**Repo / worktree:** `/Users/victorryabkov/projects/personal/gipiti/app-wt-activity`
(branch `feat/user-activity-day`, cut from `origin/main` at `a210eda`, deps installed).
All paths below are relative to that worktree. This task changes the **app**, not the
dashboard.

**Contract source:** `admin-dashboard/docs/activity-decisions.md` ("Table contract").
Background and the reasons for each choice: `admin-dashboard/docs/activity-analysis.md`
sections A, B, C, E. You do not need to read those. Everything required is below, and every
line citation was re-checked against this worktree on 2026-10-18.

---

## 1. Goal and definition of done

The admin dashboard needs DAU / MAU / retention. Logins are not recorded anywhere, so the
app gets a new table, `"UserActivityDay"`, with one row per user per **Moscow calendar
day** on which that user made at least one authenticated request. Two call sites write it:
the `(chat)` layout (every hard load of `/chat`, `/chat/[id]`, `/projects`, `/projects/[id]`
and `/prompts` with a live session) and `POST /api/chat` (this catches a tab left open across
midnight that keeps chatting). Each process writes at most once per user per Moscow day: a
bounded in-memory `Map` dedups the calls. The write runs fire-and-forget through `after()`
from `next/server`. It must never delay, fail or change a user-facing response.

**Done when:**
- `lib/db/schema.ts` defines `userActivityDay` exactly as in §2.1.
- Migration `0045_user_activity_day.sql`, its `_journal.json` entry and
  `meta/0045_snapshot.json` exist exactly as in §2.2–2.4.
- `lib/db/query/activity/record-user-activity-day.ts` and `lib/activity/record-user-activity.ts`
  exist with the exports in §2.5–2.6.
- The two call sites from §2.7 are wired.
- The unit tests in §3 exist and pass.
- `pnpm check` is green: typecheck, lint + format, unit tests and build.
- The plan file from §4.1 is saved with `status: done`.

---

## 2. Files and exact code

### 2.1 `lib/db/schema.ts` (modify)

1. Add `date` to the `drizzle-orm/pg-core` import list (lines 2-19). Keep the list
   alphabetical: `boolean,` then **`date,`** then `decimal,`. `date` is not imported today.
2. Append a new section at the **end of the file**, after
   `export type QuizResponse = InferSelectModel<typeof quizResponse>;` (line 714). The
   style matches `promptFavorite` (lines 669-685): an object-returning table callback,
   `primaryKey({ columns })`, snake_case physical columns, `references(… cascade)`.

```ts
// ============================================================================
// ACTIVITY (one row per user per Moscow calendar day with an authenticated request)
// ============================================================================

// Written fire-and-forget by lib/activity/record-user-activity.ts and read by the
// admin dashboard for DAU / MAU / retention. `activity_day` is the Moscow calendar
// day computed in the app (not in SQL) so the dedup key and the row always agree.
export const userActivityDay = pgTable(
  "UserActivityDay",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Drizzle's default `date` mode is "string": values are "YYYY-MM-DD".
    activityDay: date("activity_day").notNull(),
    firstSeenAt: timestamp("first_seen_at").notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.activityDay] }),
    dayIdx: index("user_activity_day_day_idx").on(table.activityDay),
  })
);

export type UserActivityDay = InferSelectModel<typeof userActivityDay>;
```

### 2.2 `lib/db/migrations/0045_user_activity_day.sql` (create)

Write it by hand. **Do not run `pnpm db:generate`**: it is broken (drizzle-kit 0.25 vs
drizzle-orm 0.45; app `CLAUDE.md`, Common Gotchas #3). The style copies
`0039_simple_kid_colt.sql:16-36`, the `PromptFavorite` migration. Exact content:

```sql
-- Daily activity marker for DAU / MAU / retention (admin dashboard).
-- One row per user per Moscow calendar day on which the user made at least one
-- authenticated request. Written by the app with INSERT ... ON CONFLICT DO NOTHING;
-- holds no PII beyond user_id. New empty table, so no lock concerns.
CREATE TABLE IF NOT EXISTS "UserActivityDay" (
	"user_id" uuid NOT NULL,
	"activity_day" date NOT NULL,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "UserActivityDay_user_id_activity_day_pk" PRIMARY KEY("user_id","activity_day")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserActivityDay" ADD CONSTRAINT "UserActivityDay_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_activity_day_day_idx" ON "UserActivityDay" USING btree ("activity_day");
```

(Indent the column lines with a tab, as `0039` does.)

### 2.3 `lib/db/migrations/meta/_journal.json` (modify)

Append this object after the `idx: 44` entry. Add a comma after the `0044` entry's closing `}`:

```json
    {
      "idx": 45,
      "version": "7",
      "when": 1792322105448,
      "tag": "0045_user_activity_day",
      "breakpoints": true
    }
```

- **Use this exact `when`.** It is 2026-10-18T11:15:05Z, strictly greater than 0044's
  `1792320540794`.
- The drizzle migrator applies only entries whose `when` is greater than the last applied
  migration's `created_at`. A smaller or equal value is **silently skipped** in prod.
- Do not use a value in the future either. A later migration authored with `Date.now()`
  would then sort below this one and be skipped.

### 2.4 `lib/db/migrations/meta/0045_snapshot.json` (create)

**Is it required?** No, not at runtime. `lib/db/migrate.ts` calls drizzle's `migrate()` with
`migrationsFolder: "./lib/db/migrations"`, and the migrator reads only `meta/_journal.json`
and `<tag>.sql` (`node_modules/drizzle-orm/migrator.js`). Snapshots are drizzle-kit state.
The repo convention is still one snapshot per migration (`0037…0044_snapshot.json`), and #245
hand-wrote `0044_snapshot.json`. **Follow the convention.** A missing or stale snapshot would
corrupt the diff the next time someone fixes `db:generate`.

Content:
- the whole of `0044_snapshot.json`, with
- `"id": "de75f2b6-ab3e-45aa-9569-8158c0c578b3"` (new),
- `"prevId": "c2602871-ecab-4584-b19c-cb90b84929ac"` (0044's `id`),
- one new entry in `tables`, **placed between `"public.User"` and `"public.UserSubscription"`**.
  The keys are sorted alphabetically, and `UserA…` sorts before `UserS…`.

New table entry. The shapes are copied from `"public.PromptFavorite"` (0044 snapshot lines
1079-1131) and the `transaction_type_created_idx` index entry (lines 1610-1630):

```json
"public.UserActivityDay": {
  "name": "UserActivityDay",
  "schema": "",
  "columns": {
    "user_id": { "name": "user_id", "type": "uuid", "primaryKey": false, "notNull": true },
    "activity_day": { "name": "activity_day", "type": "date", "primaryKey": false, "notNull": true },
    "first_seen_at": {
      "name": "first_seen_at",
      "type": "timestamp",
      "primaryKey": false,
      "notNull": true,
      "default": "now()"
    }
  },
  "indexes": {
    "user_activity_day_day_idx": {
      "name": "user_activity_day_day_idx",
      "columns": [
        { "expression": "activity_day", "isExpression": false, "asc": true, "nulls": "last" }
      ],
      "isUnique": false,
      "concurrently": false,
      "method": "btree",
      "with": {}
    }
  },
  "foreignKeys": {
    "UserActivityDay_user_id_User_id_fk": {
      "name": "UserActivityDay_user_id_User_id_fk",
      "tableFrom": "UserActivityDay",
      "tableTo": "User",
      "columnsFrom": ["user_id"],
      "columnsTo": ["id"],
      "onDelete": "cascade",
      "onUpdate": "no action"
    }
  },
  "compositePrimaryKeys": {
    "UserActivityDay_user_id_activity_day_pk": {
      "name": "UserActivityDay_user_id_activity_day_pk",
      "columns": ["user_id", "activity_day"]
    }
  },
  "uniqueConstraints": {}
}
```

**How to produce it without hand-merging 2 000 lines:**
- Run this one-off script from the worktree root. Do not commit it.
- Then run `pnpm format`.
- Verified: `JSON.stringify(…, null, 2)` followed by the Biome formatter reproduces
  `0044_snapshot.json` byte for byte. So the only diff against 0044 is your additions.

```bash
node -e '
const fs = require("fs");
const dir = "lib/db/migrations/meta";
const snapshot = JSON.parse(fs.readFileSync(`${dir}/0044_snapshot.json`, "utf8"));
const newTable = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
snapshot.id = "de75f2b6-ab3e-45aa-9569-8158c0c578b3";
snapshot.prevId = "c2602871-ecab-4584-b19c-cb90b84929ac";
const tables = {};
for (const [key, value] of Object.entries(snapshot.tables)) {
  tables[key] = value;
  if (key === "public.User") tables["public.UserActivityDay"] = newTable;
}
snapshot.tables = tables;
fs.writeFileSync(`${dir}/0045_snapshot.json`, `${JSON.stringify(snapshot, null, 2)}\n`);
' /path/to/scratch/user-activity-day-table.json
```

Write the table JSON above, without the outer `"public.UserActivityDay":` key, to a
scratch file **outside the repo** and pass its path. Check afterwards:
- `git diff --no-index lib/db/migrations/meta/0044_snapshot.json lib/db/migrations/meta/0045_snapshot.json`
  shows only `id`, `prevId` and the new table block.

### 2.5 `lib/db/query/activity/record-user-activity-day.ts` (create)

- **Folder convention:** queries live one function per file under
  `lib/db/query/<domain>/<verb-noun>.ts`, using relative imports of `db` and the schema.
  The domains are `chat`, `document`, `project`, `prompt`, `quiz`, `subscription`, `user`.
  `activity` is a new domain folder.
- **Pattern reference:** `lib/db/query/prompt/add-prompt-favorite.ts`.
- **Raw SQL:** this helper uses raw SQL through `db.execute(sql…)`, as `app/api/health/route.ts:37` does.
- **Why `INSERT … SELECT FROM "User"`:**
  - `scripts/delete-users.ts` hard-deletes users, and their JWT stays valid.
  - A plain `INSERT … VALUES` would then fail with FK violation `23503` on every request
    until the token expires.
  - The `SELECT` form inserts 0 rows silently instead.
- **Why it does not catch:** unlike the `ChatSDKError` wrapping in the other query files,
  this helper lets the error propagate. Its only caller (§2.6) runs inside `after()`, logs
  the original Drizzle error (the SQLSTATE is on `error.cause`), and never surfaces it.
  Wrapping it in `ChatSDKError("bad_request:database")` would throw that context away.

```ts
import { sql } from "drizzle-orm";

import { db } from "../../connection";

/**
 * Marks `userId` as active on `activityDay` (Moscow calendar day, "YYYY-MM-DD").
 *
 * Idempotent: the (user_id, activity_day) primary key plus ON CONFLICT DO NOTHING
 * keeps the first write of the day, so `first_seen_at` is the first request that
 * reached the DB. Selecting from "User" instead of inserting VALUES makes a
 * deleted user (whose JWT is still valid) a silent no-op rather than an FK error.
 *
 * Throws on DB errors. The caller runs it inside `after()` and logs them.
 */
export async function recordUserActivityDay(
  userId: string,
  activityDay: string
): Promise<void> {
  await db.execute(sql`
    INSERT INTO "UserActivityDay" ("user_id", "activity_day")
    SELECT "id", ${activityDay}::date
    FROM "User"
    WHERE "id" = ${userId}::uuid
    ON CONFLICT DO NOTHING
  `);
}
```

### 2.6 `lib/activity/record-user-activity.ts` (create)

**Existing Moscow-time code:**
- The only existing Moscow-time code is display formatting in
  `lib/utils/format-billing.ts:51-61`: `Intl.DateTimeFormat("ru-RU", { …, timeZone: "Europe/Moscow" })`.
  Its comment at `:51-52` notes that servers run in UTC on Vercel.
- There is no date-key helper. No `date-fns-tz`, no `getTimezoneOffset`, and no SQL `timezone(...)`.
- So `getMoscowDay` is new and lives here.
- It uses `formatToParts`, not the `en-CA` string shape, so it does not depend on ICU locale data.

**Constants:** keep the constants in this file, not in `lib/constants.ts`.
`lib/constants.ts` imports `./db/utils` at load time, so pulling it into this module
gains nothing. `MAX_REMEMBERED_USERS` is exported only so the test can use it.

**Logging:**
- The app has no server logger. `lib/client-logger.ts` is browser-only (`navigator.sendBeacon`).
- Server code logs with `console.error("[scope] …", context)`. Examples:
  `app/(chat)/api/chat/_lib/prepare-chat-turn.ts:236` and `:278` (inside `after()`), and
  `lib/geo/registration-geo.ts:55`.
- Biome's `noConsole` is off in `biome.json`.

```ts
import "server-only";

import { after } from "next/server";

import { recordUserActivityDay } from "@/lib/db/query/activity/record-user-activity-day";

const MOSCOW_TIME_ZONE = "Europe/Moscow";

/**
 * Upper bound on users remembered per server instance (~100 B each, about 1 MB).
 * When full, the oldest entry is evicted; the worst case is one extra
 * idempotent INSERT for that user.
 */
export const MAX_REMEMBERED_USERS = 10_000;

const moscowDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: MOSCOW_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** userId -> Moscow day already scheduled for writing by this instance. Insertion-ordered. */
const recordedDayByUserId = new Map<string, string>();

/**
 * Moscow calendar day of `now` as "YYYY-MM-DD".
 * Moscow is UTC+3 with no DST, so 20:59:59Z is still day D and 21:00:00Z is D+1.
 */
export const getMoscowDay = (now: Date = new Date()): string => {
  const parts = moscowDayFormatter.formatToParts(now);
  const getPart = (partType: Intl.DateTimeFormatPartTypes): string =>
    parts.find(({ type }) => type === partType)?.value ?? "";

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
};

/** Remembers the day for `userId`, evicting the oldest entry when the cap is hit. */
const rememberRecordedDay = (userId: string, activityDay: string): void => {
  // Re-inserting moves the user to the newest position.
  recordedDayByUserId.delete(userId);

  if (recordedDayByUserId.size >= MAX_REMEMBERED_USERS) {
    const oldestUserId = recordedDayByUserId.keys().next().value;
    if (oldestUserId !== undefined) {
      recordedDayByUserId.delete(oldestUserId);
    }
  }

  recordedDayByUserId.set(userId, activityDay);
};

/** Drops the marker so the next request retries. Keeps it if a newer day replaced it. */
const forgetRecordedDay = (userId: string, activityDay: string): void => {
  if (recordedDayByUserId.get(userId) === activityDay) {
    recordedDayByUserId.delete(userId);
  }
};

const writeActivityDay = async (userId: string, activityDay: string): Promise<void> => {
  try {
    await recordUserActivityDay(userId, activityDay);
  } catch (error) {
    forgetRecordedDay(userId, activityDay);
    console.error("[activity] Failed to record user activity day:", {
      userId,
      activityDay,
      error,
    });
  }
};

/**
 * Records that `userId` made an authenticated request today (Moscow day).
 *
 * At most one DB write per user per instance per day. The write runs in `after()`,
 * so it never delays the response. This function never throws: the caller is
 * a layout or route handler that must not fail because of analytics.
 */
export const recordUserActivity = (userId: string): void => {
  const activityDay = getMoscowDay();
  if (recordedDayByUserId.get(userId) === activityDay) {
    return;
  }

  rememberRecordedDay(userId, activityDay);

  try {
    after(() => writeActivityDay(userId, activityDay));
  } catch (error) {
    // after() throws outside a request scope; never let that reach the user.
    forgetRecordedDay(userId, activityDay);
    console.error("[activity] Failed to schedule user activity write:", {
      userId,
      activityDay,
      error,
    });
  }
};
```

If Biome reports a line over the formatter width, run `pnpm format`. Do not restructure the
code to fit.

### 2.7 Call sites (modify)

**Rules for `after()` at these call sites:**
- `after()` is allowed in Server Components, including layouts, and in Route Handlers.
  See `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`.
- The callback must not call `cookies()` or `headers()`. Ours only captures `userId` and
  `activityDay`.
- The `(chat)` layout is already dynamic because it reads `cookies()`, so nothing changes
  about rendering.

**(a) `app/(chat)/layout.tsx`**
- **Import:** add it in the alphabetical block of `@/` imports, after the
  `@/contexts/web-search-context` import (line 8) and before the `@/lib/ai/models`
  import (line 9).
- **Call:** insert it after line 35.
- The layout renders for anonymous visitors too: it does not redirect. So guard the call.

```tsx
import { WebSearchProvider } from "@/contexts/web-search-context";
import { recordUserActivity } from "@/lib/activity/record-user-activity";
import {
  chatModelIds,
```

```tsx
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);

  // Daily-active marker for the admin dashboard; deduped and fire-and-forget.
  if (session?.user?.id) {
    recordUserActivity(session.user.id);
  }

  const isCollapsed = cookieStore.get("sidebar_state")?.value !== "true";
```

**(b) `app/(chat)/api/chat/route.ts`**
- **Import:** add it after `import { auth } from "@/app/(auth)/auth";` (line 2).
- **Call:** insert it after the session check (lines 34-37) and before `try {` (line 39).
- `session.user.id` is a non-optional `string` (`types/next-auth.d.ts:9`), and
  `session.user` is already narrowed here.

```ts
import { auth } from "@/app/(auth)/auth";
import { recordUserActivity } from "@/lib/activity/record-user-activity";
import { deleteChatById } from "@/lib/db/query/chat/delete-chat-by-id";
```

```ts
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  // Catches tabs left open across Moscow midnight that chat without reloading.
  recordUserActivity(session.user.id);

  try {
    const ctx = await prepareChatTurn(parsed.body, session, request);
```

Do not add calls anywhere else: not `history`, not `vote`, not `files`, not the
subscription pages.

---

## 3. Tests: `lib/activity/__tests__/record-user-activity.test.ts` (create)

**Layout:**
- Vitest picks up only `**/__tests__/**/*.test.ts` (`vitest.config.ts`). The `@/` alias
  is configured there.
- Follow `lib/billing/__tests__/refund.test.ts`: AAA comments and descriptive `it` names.
- Mock `server-only` the way `lib/ai/__tests__/text-attachments.test.ts:16` does.
- Do not touch a real DB.

**Mocks and setup:**
- Create the mocks with `vi.hoisted`, so the same `vi.fn()` instances survive `vi.resetModules()`.
- Re-import the module in `beforeEach`. Each test then gets a fresh `Map`, and no
  test-only export is needed.
- Use fake timers with `vi.setSystemTime` for "now".

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ScheduledTask = () => Promise<void>;

const { afterMock, recordUserActivityDayMock } = vi.hoisted(() => ({
  afterMock: vi.fn(),
  recordUserActivityDayMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: afterMock }));
vi.mock("@/lib/db/query/activity/record-user-activity-day", () => ({
  recordUserActivityDay: recordUserActivityDayMock,
}));

type ActivityModule = typeof import("../record-user-activity");

let activity: ActivityModule;

beforeEach(async () => {
  vi.resetModules();
  afterMock.mockReset();
  recordUserActivityDayMock.mockReset();
  recordUserActivityDayMock.mockResolvedValue(undefined);
  vi.useFakeTimers();
  activity = await import("../record-user-activity");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const getScheduledTask = (callIndex: number): ScheduledTask =>
  afterMock.mock.calls[callIndex][0] as ScheduledTask;
```

Required cases. Add others if useful.

**`describe("getMoscowDay")`**
1. `"keeps the same Moscow day at 20:59:59.999 UTC"`: `new Date("2026-10-18T20:59:59.999Z")`
   gives `"2026-10-18"`.
2. `"switches to the next Moscow day at 21:00 UTC"`: `new Date("2026-10-18T21:00:00.000Z")`
   gives `"2026-10-19"`.
3. `"rolls over the year at Moscow midnight"`: `new Date("2026-12-31T21:00:00.000Z")` gives
   `"2027-01-01"`.
4. `"defaults to the current time"`: `vi.setSystemTime(new Date("2026-10-18T10:00:00Z"))`,
   then `getMoscowDay()` gives `"2026-10-18"`.

**`describe("recordUserActivity")`**
5. `"schedules one write and skips repeat calls on the same Moscow day"`:
   - Set the time to `2026-10-18T10:00:00Z` and call `recordUserActivity("user-1")` twice.
   - `afterMock` is called once.
   - Then `await getScheduledTask(0)()`. `recordUserActivityDayMock` is called with
     `("user-1", "2026-10-18")`.
6. `"schedules again once the Moscow day changes"`:
   - Call at `2026-10-18T20:59:59Z`, then call again at `2026-10-18T21:00:00Z`.
   - `afterMock` is called twice. The second task writes `"2026-10-19"`.
7. `"tracks users independently"`: `"user-1"` and `"user-2"` on the same day give 2 calls.
8. `"never throws and retries after a failed write"`:
   - `recordUserActivityDayMock.mockRejectedValueOnce(new Error("db down"))`, and spy on
     `console.error` with a silent implementation.
   - Call, then `await expect(getScheduledTask(0)()).resolves.toBeUndefined()`.
   - `console.error` was called.
   - A second call on the same day schedules again: `afterMock` is called twice.
9. `"does not throw when after() is unavailable"`:
   - `afterMock.mockImplementationOnce(() => { throw new Error("outside request scope"); })`
     and silence `console.error`.
   - `expect(() => activity.recordUserActivity("user-1")).not.toThrow()`.
   - The next call schedules: the marker was dropped.
10. `"evicts the oldest user when the cache is full"`:
    - Call for `user-0` … `user-${MAX_REMEMBERED_USERS}`, which is
      `MAX_REMEMBERED_USERS + 1` users, all on the same day. Set
      `const callsAfterFill = afterMock.mock.calls.length`.
    - Call `user-${MAX_REMEMBERED_USERS}` again: there is no new call.
    - Call `user-0` again: one new call, because it was evicted.

---

## 4. Constraints

### 4.1 Plan file

App `CLAUDE.md` > Plans requires a plan for work that touches more than 2 files.
- Before writing code, save this spec's content as `docs/plans/2026-10-18-user-activity-day.md`
  with frontmatter `date: 2026-10-18`, `status: in-progress`,
  `branch: feat/user-activity-day`, and a `# User activity day table and write path` title.
- The format follows `docs/plans/2026-10-18-period-query-indexes.md`.
- The plan must cover goal, files, order, risks and verification. All of that is in this spec.
- Set `status: done` when finished.
- If you depart from this spec, update the plan in the same commit.

### 4.2 Code rules

**Biome / ultracite** (`pnpm lint` = `ultracite check`, `pnpm format` = `ultracite fix`):
- Use `type`, not `interface`.
- No `any`, and no enums.
- Use `import type` for type-only imports.
- Named exports only.
- Always use braces on `if` blocks.
- Biome sorts imports. If it complains about import order, run `pnpm format`.

**Server-only code:**
- `lib/activity/record-user-activity.ts` starts with `import "server-only";`.
  `lib/db/connection.ts` does the same.
- Never import it from a client component.
- `console.error` is fine here: the `no console.log in client code` rule targets client code.

**Errors:** the service must never throw into the layout or route. Every failure is logged
with `{ userId, activityDay, error }` and swallowed after logging. That is the explicit
contract ("never block or fail a user request").

**Other rules:**
- No UI strings, so no i18n changes.
- Keep names descriptive.
- Keep lines at or under 100 characters. Biome's formatter width wins if it is stricter.

### 4.3 DB safety

- **Does `pnpm check` touch the DB? No.** `scripts/check.ts` runs `typecheck`, `lint`,
  `test:unit`, then `pnpm exec next build`. The comment at `scripts/check.ts:181` says:
  "Plain `next build`, not `pnpm build` — that one runs DB migrations first."
- Only `pnpm build` (`"tsx lib/db/migrate && next build"`, `package.json:7`) and
  `pnpm db:migrate` apply migrations.
- **Do NOT run `pnpm build`, `pnpm db:migrate`, `pnpm db:push`, `pnpm db:generate` or
  `npx tsx lib/db/migrate.ts`** against any database, local or remote. The migration
  reaches prod only through the Vercel build of the merged PR.
- Do not run Playwright (`pnpm test`): it starts `pnpm dev` against a real DB.

### 4.4 `repo-recipes` skill

- The "Modifying Database Schema" recipe in `.claude/skills/repo-recipes/SKILL.md` says to
  run `pnpm db:generate`, then `pnpm db:migrate`. **Ignore steps 2-3.**
- Follow this spec and app `CLAUDE.md` Gotcha #3 instead: hand-written SQL plus a journal
  entry plus a snapshot.
- Step 4 ("update `lib/types.ts` if needed") does not apply. `UserActivityDay` is exported
  from `schema.ts`.
- The skill is **not tracked in git**: it exists only in the main checkout's `.claude/skills/`,
  not in this worktree. So do not try to fix it in this PR.

---

## 5. Verification

From `/Users/victorryabkov/projects/personal/gipiti/app-wt-activity`:

```bash
pnpm vitest run lib/activity/__tests__/record-user-activity.test.ts   # the new tests
pnpm check:fast                                                        # iterate
pnpm check                                                             # must be green
git diff --no-index lib/db/migrations/meta/0044_snapshot.json \
  lib/db/migrations/meta/0045_snapshot.json                            # only id/prevId/new table
git diff --stat origin/main
```

Expected `git diff --stat origin/main` file list. There are 10 files, and nothing else:
`next-env.d.ts` and `tsconfig.tsbuildinfo` are restored by `pnpm check`.

```
app/(chat)/api/chat/route.ts                          (modified, +4)
app/(chat)/layout.tsx                                 (modified, +6)
docs/plans/2026-10-18-user-activity-day.md            (new)
lib/activity/__tests__/record-user-activity.test.ts   (new)
lib/activity/record-user-activity.ts                  (new)
lib/db/migrations/0045_user_activity_day.sql          (new)
lib/db/migrations/meta/0045_snapshot.json             (new, ~2.2k lines)
lib/db/migrations/meta/_journal.json                  (modified, +7)
lib/db/query/activity/record-user-activity-day.ts     (new)
lib/db/schema.ts                                      (modified, +1 import, ~25 lines)
```

**Commit:** a single conventional commit, e.g.
`feat: record daily user activity for DAU/MAU metrics`. Do not push or open a PR unless
asked.

---

## 6. Out of scope (do not touch)

- **Dashboard side:** the whole `admin-dashboard` repo. That means the `/activity` page,
  queries, the `to_regclass` empty-state check and Prisma.
- **Proxy and auth:** `proxy.ts`, and the `jwt()` / `session()` callbacks in
  `app/(auth)/auth.ts`. Also no JWT or cookie markers.
- **Other call sites:** no extra calls in `app/subscription/*`,
  `app/(auth)/manage-subscription/*`, or any other API route.
- **History:** backfilling past days from `Message_v2` or anything else. Also no
  retention or purge job.
- **SQL default:** no SQL-side `DEFAULT timezone('Europe/Moscow', now())::date` on
  `activity_day`.
- **The `repo-recipes` skill**, and any refactor of the existing query files.
