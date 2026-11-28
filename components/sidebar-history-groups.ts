import type { ChatDto } from "@/client/shared/api/types";

export type ChatGroupKey =
  | "today"
  | "yesterday"
  | "lastWeek"
  | "lastMonth"
  | "older";

export type GroupedChats = Record<ChatGroupKey, ChatDto[]>;

type ChatGroupDefinition = {
  key: ChatGroupKey;
  /** Key of the `chat.sidebar` namespace with the group's heading. */
  labelKey: string;
  headingClassName: string;
};

const DEFAULT_HEADING_CLASS = "px-2 py-1 text-ink-3 text-xs";

/** The groups in display order. */
export const CHAT_GROUPS: readonly ChatGroupDefinition[] = [
  {
    key: "today",
    labelKey: "today",
    headingClassName:
      "px-3 py-1.5 font-mono text-[10px] text-ink-3 uppercase tracking-[0.1em]",
  },
  {
    key: "yesterday",
    labelKey: "yesterday",
    headingClassName: DEFAULT_HEADING_CLASS,
  },
  {
    key: "lastWeek",
    labelKey: "last7Days",
    headingClassName: DEFAULT_HEADING_CLASS,
  },
  {
    key: "lastMonth",
    labelKey: "last30Days",
    headingClassName: DEFAULT_HEADING_CLASS,
  },
  {
    key: "older",
    labelKey: "older",
    headingClassName: DEFAULT_HEADING_CLASS,
  },
];

const MS_IN_DAY = 86_400_000;
const DAYS_IN_WEEK = 7;
const DAYS_IN_MONTH = 30;

const getUtcDay = (date: Date): number =>
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

const getUtcDayDiff = (date: Date, now: Date): number =>
  Math.floor((getUtcDay(now) - getUtcDay(date)) / MS_IN_DAY);

const getGroupKey = (chat: ChatDto, now: Date): ChatGroupKey => {
  const dayDiff = getUtcDayDiff(new Date(chat.createdAt), now);

  if (dayDiff === 0) {
    return "today";
  }
  if (dayDiff === 1) {
    return "yesterday";
  }
  if (dayDiff < DAYS_IN_WEEK) {
    return "lastWeek";
  }

  return dayDiff < DAYS_IN_MONTH ? "lastMonth" : "older";
};

/** Splits chats (newest first) into the sidebar's date groups, keeping the order. */
export const groupChatsByDate = (chats: ChatDto[], now: Date): GroupedChats => {
  const groups: GroupedChats = {
    today: [],
    yesterday: [],
    lastWeek: [],
    lastMonth: [],
    older: [],
  };
  for (const chat of chats) {
    groups[getGroupKey(chat, now)].push(chat);
  }

  return groups;
};
