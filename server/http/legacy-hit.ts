import { sql } from "drizzle-orm";
import { after } from "next/server";

import { db } from "@/server/db/connection";
import { legacyHit } from "@/server/db/schema";

type IncrementLegacyHitInput = {
  name: string;
  /** The moment of the hit; the UTC day of it is counted. Defaults to now. */
  at?: Date;
};

/** "YYYY-MM-DD" of `moment` in UTC. */
const utcDayOf = (moment: Date): string => moment.toISOString().slice(0, 10);

/**
 * Add one hit to `name` for the UTC day of `at`, in a single statement, so
 * concurrent hits never lose a count.
 */
export const incrementLegacyHit = async ({
  name,
  at = new Date(),
}: IncrementLegacyHitInput): Promise<void> => {
  await db
    .insert(legacyHit)
    .values({ name, day: utcDayOf(at), count: 1 })
    .onConflictDoUpdate({
      target: [legacyHit.name, legacyHit.day],
      set: { count: sql`${legacyHit.count} + 1` },
    });
};

const incrementAndSwallowFailure = async (name: string): Promise<void> => {
  try {
    await incrementLegacyHit({ name });
  } catch (error) {
    // A broken counter must never break the legacy route that called it.
    console.error(`Could not count a legacy hit for "${name}"`, error);
  }
};

/**
 * Count one call of a legacy route or server action, so that the Phase 12
 * gate ("no hits for 14 days") can be read from the `LegacyHit` table.
 *
 * `name` is `"<METHOD> <path>"` for a route (`"GET /api/prompts"`) and
 * `"action <name>"` for a server action (`"action selectModel"`).
 *
 * The write runs after the response is sent (`after()`), so it does not take a
 * pool connection while the route is still working. This function never
 * throws: a failure is logged and dropped.
 */
export const recordLegacyHit = (name: string): void => {
  try {
    after(() => incrementAndSwallowFailure(name));
  } catch {
    // `after()` throws outside a request scope (a script, a test). Nothing
    // waits for the write; the promise is not awaited and cannot reject.
    incrementAndSwallowFailure(name);
  }
};
