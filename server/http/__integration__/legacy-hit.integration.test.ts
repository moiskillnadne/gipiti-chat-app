import { asc } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db/connection";
import { type LegacyHit, legacyHit } from "@/server/db/schema";
import { incrementLegacyHit } from "@/server/http/legacy-hit";
import { closeDatabaseConnection } from "@/tests/integration/helpers";

const ROUTE_NAME = "GET /api/prompts";
const OTHER_NAME = "action selectModel";
const CONCURRENT_HITS = 10;

const NOON_ON_FIRST_DAY = new Date("2026-11-28T12:00:00.000Z");
const LAST_SECOND_OF_FIRST_DAY = new Date("2026-11-28T23:59:59.999Z");
const FIRST_SECOND_OF_NEXT_DAY = new Date("2026-11-29T00:00:00.000Z");

const readAllRows = (): Promise<LegacyHit[]> =>
  db.select().from(legacyHit).orderBy(asc(legacyHit.name), asc(legacyHit.day));

describe("incrementLegacyHit against a real database", () => {
  beforeEach(async () => {
    // The shared money reset does not cover this table.
    await db.delete(legacyHit);
  });

  afterAll(async () => {
    await closeDatabaseConnection();
  });

  it("counts two hits for one name on one day in a single row", async () => {
    // Act
    await incrementLegacyHit({ name: ROUTE_NAME, at: NOON_ON_FIRST_DAY });
    await incrementLegacyHit({ name: ROUTE_NAME, at: NOON_ON_FIRST_DAY });

    // Assert
    expect(await readAllRows()).toEqual([
      { name: ROUTE_NAME, day: "2026-11-28", count: 2 },
    ]);
  });

  it("gives another name its own row", async () => {
    // Act
    await incrementLegacyHit({ name: ROUTE_NAME, at: NOON_ON_FIRST_DAY });
    await incrementLegacyHit({ name: OTHER_NAME, at: NOON_ON_FIRST_DAY });

    // Assert
    expect(await readAllRows()).toEqual([
      { name: OTHER_NAME, day: "2026-11-28", count: 1 },
      { name: ROUTE_NAME, day: "2026-11-28", count: 1 },
    ]);
  });

  it("starts a new row at midnight UTC", async () => {
    // Act
    await incrementLegacyHit({
      name: ROUTE_NAME,
      at: LAST_SECOND_OF_FIRST_DAY,
    });
    await incrementLegacyHit({
      name: ROUTE_NAME,
      at: FIRST_SECOND_OF_NEXT_DAY,
    });

    // Assert
    expect(await readAllRows()).toEqual([
      { name: ROUTE_NAME, day: "2026-11-28", count: 1 },
      { name: ROUTE_NAME, day: "2026-11-29", count: 1 },
    ]);
  });

  it("loses no count when hits arrive at the same time", async () => {
    // Act
    await Promise.all(
      Array.from({ length: CONCURRENT_HITS }, () =>
        incrementLegacyHit({ name: ROUTE_NAME, at: NOON_ON_FIRST_DAY })
      )
    );

    // Assert
    expect(await readAllRows()).toEqual([
      { name: ROUTE_NAME, day: "2026-11-28", count: CONCURRENT_HITS },
    ]);
  });
});
