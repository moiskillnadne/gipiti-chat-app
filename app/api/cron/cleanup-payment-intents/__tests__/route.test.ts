import { beforeEach, describe, expect, it, vi } from "vitest";

type ReturnedIntentRow = { id: string };

type IntentUpdate = Record<string, unknown>;

const { dbState } = vi.hoisted(() => ({
  dbState: {
    expiredRows: [] as ReturnedIntentRow[],
    deletedRows: [] as ReturnedIntentRow[],
    updates: [] as IntentUpdate[],
    updateCalls: 0,
    deleteCalls: 0,
    deleteError: null as Error | null,
  },
}));

// Minimal Drizzle stand-in: `update().set().where().returning()` resolves to
// the rows the UPDATE would return, `delete().where().returning()` to the rows
// the DELETE would return. Which rows match is covered by the integration test.
vi.mock("@/lib/db/connection", () => ({
  db: {
    update: () => {
      dbState.updateCalls += 1;
      return {
        set: (values: IntentUpdate) => {
          dbState.updates.push(values);
          return {
            where: () => ({
              returning: () => Promise.resolve(dbState.expiredRows),
            }),
          };
        },
      };
    },
    delete: () => {
      dbState.deleteCalls += 1;
      return {
        where: () => ({
          returning: () =>
            dbState.deleteError
              ? Promise.reject(dbState.deleteError)
              : Promise.resolve(dbState.deletedRows),
        }),
      };
    },
  },
}));

import { GET } from "../route";

const CRON_SECRET = "test-cron-secret";
const CRON_URL = "https://example.test/api/cron/cleanup-payment-intents";

const buildRows = (count: number): ReturnedIntentRow[] =>
  Array.from({ length: count }, (_unused, position) => ({
    id: `intent_${position}`,
  }));

const callCron = async (authorization?: string): Promise<Response> =>
  GET(
    new Request(CRON_URL, {
      headers: authorization ? { authorization } : {},
    })
  );

describe("GET /api/cron/cleanup-payment-intents", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", CRON_SECRET);
    vi.spyOn(console, "log").mockReturnValue(undefined);
    vi.spyOn(console, "error").mockReturnValue(undefined);
    dbState.expiredRows = [];
    dbState.deletedRows = [];
    dbState.updates = [];
    dbState.updateCalls = 0;
    dbState.deleteCalls = 0;
    dbState.deleteError = null;
  });

  it("returns 401 without the cron secret and touches nothing", async () => {
    // Act
    const response = await callCron();

    // Assert
    expect(response.status).toBe(401);
    expect(dbState.updateCalls).toBe(0);
    expect(dbState.deleteCalls).toBe(0);
  });

  it("returns 401 for a wrong secret", async () => {
    // Act
    const response = await callCron("Bearer wrong-secret");

    // Assert
    expect(response.status).toBe(401);
    expect(dbState.updateCalls).toBe(0);
    expect(dbState.deleteCalls).toBe(0);
  });

  it("rejects `Bearer undefined` when CRON_SECRET is not configured", async () => {
    // Arrange
    vi.stubEnv("CRON_SECRET", undefined);

    // Act
    const response = await callCron("Bearer undefined");

    // Assert
    expect(response.status).toBe(401);
    expect(dbState.updateCalls).toBe(0);
    expect(dbState.deleteCalls).toBe(0);
  });

  it("reports how many intents were expired and deleted", async () => {
    // Arrange
    dbState.expiredRows = buildRows(3);
    dbState.deletedRows = buildRows(2);

    // Act
    const response = await callCron(`Bearer ${CRON_SECRET}`);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body).toEqual({
      expired: 3,
      deleted: 2,
      timestamp: expect.any(String),
      message:
        "Marked 3 payment intents as expired. Deleted 2 old payment intents.",
    });
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  });

  it("uses one UPDATE and one DELETE however many intents match", async () => {
    // Arrange
    dbState.expiredRows = buildRows(50);
    dbState.deletedRows = buildRows(40);

    // Act
    await callCron(`Bearer ${CRON_SECRET}`);

    // Assert
    expect(dbState.updateCalls).toBe(1);
    expect(dbState.deleteCalls).toBe(1);
    expect(dbState.updates).toEqual([
      { status: "expired", updatedAt: expect.any(Date) },
    ]);
  });

  it("logs the 30-day retention period", async () => {
    // Arrange
    const logSpy = vi.spyOn(console, "log").mockReturnValue(undefined);

    // Act
    await callCron(`Bearer ${CRON_SECRET}`);

    // Assert
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("older than 30 days")
    );
  });

  it("returns 500 and logs the error when the database fails", async () => {
    // Arrange
    const databaseError = new Error("db unavailable");
    dbState.deleteError = databaseError;
    const errorSpy = vi.spyOn(console, "error").mockReturnValue(undefined);

    // Act
    const response = await callCron(`Bearer ${CRON_SECRET}`);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Payment intent cleanup failed" });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Payment intent cleanup failed"),
      databaseError
    );
  });
});
