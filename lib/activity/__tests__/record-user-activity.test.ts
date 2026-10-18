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

describe("getMoscowDay", () => {
  it("keeps the same Moscow day at 20:59:59.999 UTC", () => {
    // Arrange
    const now = new Date("2026-10-18T20:59:59.999Z");

    // Act
    const day = activity.getMoscowDay(now);

    // Assert
    expect(day).toBe("2026-10-18");
  });

  it("switches to the next Moscow day at 21:00 UTC", () => {
    const day = activity.getMoscowDay(new Date("2026-10-18T21:00:00.000Z"));

    expect(day).toBe("2026-10-19");
  });

  it("rolls over the year at Moscow midnight", () => {
    const day = activity.getMoscowDay(new Date("2026-12-31T21:00:00.000Z"));

    expect(day).toBe("2027-01-01");
  });

  it("defaults to the current time", () => {
    vi.setSystemTime(new Date("2026-10-18T10:00:00Z"));

    expect(activity.getMoscowDay()).toBe("2026-10-18");
  });
});

describe("recordUserActivity", () => {
  it("schedules one write and skips repeat calls on the same Moscow day", async () => {
    // Arrange
    vi.setSystemTime(new Date("2026-10-18T10:00:00Z"));

    // Act
    activity.recordUserActivity("user-1");
    activity.recordUserActivity("user-1");
    await getScheduledTask(0)();

    // Assert
    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(recordUserActivityDayMock).toHaveBeenCalledWith(
      "user-1",
      "2026-10-18"
    );
  });

  it("schedules again once the Moscow day changes", async () => {
    // Arrange
    vi.setSystemTime(new Date("2026-10-18T20:59:59Z"));
    activity.recordUserActivity("user-1");

    // Act
    vi.setSystemTime(new Date("2026-10-18T21:00:00Z"));
    activity.recordUserActivity("user-1");
    await getScheduledTask(1)();

    // Assert
    expect(afterMock).toHaveBeenCalledTimes(2);
    expect(recordUserActivityDayMock).toHaveBeenCalledWith(
      "user-1",
      "2026-10-19"
    );
  });

  it("tracks users independently", () => {
    vi.setSystemTime(new Date("2026-10-18T10:00:00Z"));

    activity.recordUserActivity("user-1");
    activity.recordUserActivity("user-2");

    expect(afterMock).toHaveBeenCalledTimes(2);
  });

  it("never throws and retries after a failed write", async () => {
    // Arrange
    vi.setSystemTime(new Date("2026-10-18T10:00:00Z"));
    recordUserActivityDayMock.mockRejectedValueOnce(new Error("db down"));
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockReturnValue(undefined);

    // Act
    activity.recordUserActivity("user-1");
    await expect(getScheduledTask(0)()).resolves.toBeUndefined();
    activity.recordUserActivity("user-1");

    // Assert
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(afterMock).toHaveBeenCalledTimes(2);
  });

  it("does not throw when after() is unavailable", () => {
    // Arrange
    vi.setSystemTime(new Date("2026-10-18T10:00:00Z"));
    vi.spyOn(console, "error").mockReturnValue(undefined);
    afterMock.mockImplementationOnce(() => {
      throw new Error("outside request scope");
    });

    // Act
    expect(() => activity.recordUserActivity("user-1")).not.toThrow();
    activity.recordUserActivity("user-1");

    // Assert
    expect(afterMock).toHaveBeenCalledTimes(2);
  });

  it("evicts the oldest user when the cache is full", () => {
    // Arrange
    vi.setSystemTime(new Date("2026-10-18T10:00:00Z"));
    const { MAX_REMEMBERED_USERS } = activity;
    for (let index = 0; index <= MAX_REMEMBERED_USERS; index += 1) {
      activity.recordUserActivity(`user-${index}`);
    }
    const callsAfterFill = afterMock.mock.calls.length;

    // Act
    activity.recordUserActivity(`user-${MAX_REMEMBERED_USERS}`);
    const callsAfterNewestRepeat = afterMock.mock.calls.length;
    activity.recordUserActivity("user-0");

    // Assert
    expect(callsAfterNewestRepeat).toBe(callsAfterFill);
    expect(afterMock.mock.calls.length).toBe(callsAfterFill + 1);
  });
});
