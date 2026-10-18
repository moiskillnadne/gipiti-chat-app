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

const writeActivityDay = async (
  userId: string,
  activityDay: string
): Promise<void> => {
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
