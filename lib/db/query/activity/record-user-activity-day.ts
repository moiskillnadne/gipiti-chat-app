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
