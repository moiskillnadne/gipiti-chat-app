import { and, desc, eq, gte, ne, sql } from "drizzle-orm";
import { chatModels } from "@/lib/ai/models";
import { db } from "@/lib/db/connection";
import { chat, transaction } from "@/lib/db/schema";
import { type BalanceSummary, getBalance } from "./balance";

// usage_debit rows are tagged by chargeUsage: web search/extract use these
// synthetic modelIds, image generation uses this description, everything else
// is a chat completion. See lib/billing/balance.ts + the tool callsites.
const SEARCH_MODEL_IDS = new Set(["tavily-search", "tavily-extract"]);
const IMAGE_DESCRIPTION = "Image generation";
const VIDEO_DESCRIPTION = "Video generation";

// How many recent debit rows to scan when rolling up per-chat spend. The card
// only shows the few most-recent chats, so a bounded window is plenty.
const RECENT_DEBIT_WINDOW = 500;

const MODEL_NAME_BY_ID = new Map(
  chatModels.map((model) => [model.id, model.name])
);

function modelDisplayName(modelId: string): string {
  return MODEL_NAME_BY_ID.get(modelId) ?? modelId;
}

export type ChatSpendRow = {
  chatId: string;
  title: string;
  model: string | null;
  messages: number;
  searches: number;
  images: number;
  videos: number;
  totalMinor: number;
  last: Date;
};

function createSpendRow(
  chatId: string,
  title: string,
  last: Date
): ChatSpendRow {
  return {
    chatId,
    title,
    model: null,
    messages: 0,
    searches: 0,
    images: 0,
    videos: 0,
    totalMinor: 0,
    last,
  };
}

/**
 * Roll up recent usage debits into per-chat spend: total cost, message/search/
 * image/video counts, the chat's primary model, and last activity. Most-recent chats
 * first. Built in JS over a bounded recent window (no fragile SQL aggregation).
 */
export async function getChatSpendHistory(
  userId: string,
  limit = 6
): Promise<ChatSpendRow[]> {
  const rows = await db
    .select({
      chatId: transaction.chatId,
      amount: transaction.amount,
      modelId: transaction.modelId,
      description: transaction.description,
      createdAt: transaction.createdAt,
      title: chat.title,
    })
    .from(transaction)
    .innerJoin(chat, eq(transaction.chatId, chat.id))
    .where(
      and(eq(transaction.userId, userId), eq(transaction.type, "usage_debit"))
    )
    .orderBy(desc(transaction.createdAt))
    .limit(RECENT_DEBIT_WINDOW);

  const byChat = new Map<string, ChatSpendRow>();

  for (const row of rows) {
    const chatId = row.chatId;
    if (!chatId) {
      continue;
    }

    const agg =
      byChat.get(chatId) ?? createSpendRow(chatId, row.title, row.createdAt);
    byChat.set(chatId, agg);

    agg.totalMinor += Math.abs(row.amount);
    if (row.createdAt > agg.last) {
      agg.last = row.createdAt;
    }

    const isSearch = row.modelId != null && SEARCH_MODEL_IDS.has(row.modelId);
    const isImage = row.description === IMAGE_DESCRIPTION;
    const isVideo = row.description === VIDEO_DESCRIPTION;

    if (isSearch) {
      agg.searches += 1;
    } else if (isImage) {
      agg.images += 1;
    } else if (isVideo) {
      agg.videos += 1;
    } else {
      agg.messages += 1;
      // Rows are newest-first, so the first chat model seen is the most recent.
      if (agg.model == null && row.modelId) {
        agg.model = modelDisplayName(row.modelId);
      }
    }
  }

  return Array.from(byChat.values())
    .sort((a, b) => b.last.getTime() - a.last.getTime())
    .slice(0, limit);
}

/**
 * Total spend (minor units) on usage debits over the last `sinceDays` days.
 * Feeds the history footer's "За N дней −X" run-rate cue.
 */
export async function getRecentSpendMinor(
  userId: string,
  sinceDays = 7
): Promise<number> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(abs(${transaction.amount})), 0)`,
    })
    .from(transaction)
    .where(
      and(
        eq(transaction.userId, userId),
        eq(transaction.type, "usage_debit"),
        gte(transaction.createdAt, since)
      )
    );

  return Number(row?.total ?? 0);
}

export type SpendProgress = {
  // Total balance right after the user's last credit (minor units).
  referenceTotal: number;
  // Current spendable balance (subscription + top-up pools).
  currentTotal: number;
  // Share of the epoch's reference balance already spent, 0..100 (rounded).
  spentPercent: number;
  // Identifies the current "balance epoch": the last-credit transaction id, or
  // "none" when the user has no credits yet. Changes whenever a fresh credit
  // lands, which the spend banner uses to re-arm its 50%/75% thresholds.
  epochKey: string;
};

/**
 * Progress of spend within the current "balance epoch" — the window since the
 * user's most recent credit (top-up, subscription renewal, or bonus).
 *
 * The denominator is the total balance right after that credit, recovered from
 * the transaction's `subscriptionBalanceAfter + topupBalanceAfter` snapshot:
 * between two credits the balance only declines via usage debits, so that
 * snapshot is exactly the epoch's starting total. A new credit starts a new
 * epoch (new `epochKey`) with `spentPercent` back at 0.
 *
 * Pass `balanceSummary` to reuse a balance the caller already fetched.
 */
export async function getSpendProgress(
  userId: string,
  balanceSummary?: BalanceSummary | null
): Promise<SpendProgress | null> {
  const summary =
    balanceSummary === undefined ? await getBalance(userId) : balanceSummary;
  if (!summary) {
    return null;
  }

  const currentTotal = summary.total;

  const [lastCredit] = await db
    .select({
      id: transaction.id,
      subscriptionBalanceAfter: transaction.subscriptionBalanceAfter,
      topupBalanceAfter: transaction.topupBalanceAfter,
    })
    .from(transaction)
    .where(
      and(eq(transaction.userId, userId), ne(transaction.type, "usage_debit"))
    )
    .orderBy(desc(transaction.createdAt))
    .limit(1);

  if (!lastCredit) {
    return {
      referenceTotal: currentTotal,
      currentTotal,
      spentPercent: 0,
      epochKey: "none",
    };
  }

  const referenceTotal =
    lastCredit.subscriptionBalanceAfter + lastCredit.topupBalanceAfter;

  if (referenceTotal <= 0) {
    return {
      referenceTotal,
      currentTotal,
      spentPercent: 0,
      epochKey: lastCredit.id,
    };
  }

  const spent = Math.max(0, referenceTotal - currentTotal);
  const spentPercent = Math.min(
    100,
    Math.round((spent / referenceTotal) * 100)
  );

  return {
    referenceTotal,
    currentTotal,
    spentPercent,
    epochKey: lastCredit.id,
  };
}
