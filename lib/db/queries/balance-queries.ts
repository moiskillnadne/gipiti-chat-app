/**
 * Balance queries.
 * The Balance table holds per-user billing/usage state (plan, tokens,
 * generation credits, search depth). 1:1 with User.
 */
import { eq } from "drizzle-orm";

import { ChatSDKError } from "../../errors";
import { type Balance, balance } from "../schema";
import { db } from "./connection";

export async function getBalanceByUserId(
  userId: string
): Promise<Balance | null> {
  try {
    const [row] = await db
      .select()
      .from(balance)
      .where(eq(balance.userId, userId))
      .limit(1);

    return row ?? null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to fetch user balance"
    );
  }
}

export async function getCurrentPlan(userId: string): Promise<string | null> {
  try {
    const [row] = await db
      .select({ plan: balance.plan })
      .from(balance)
      .where(eq(balance.userId, userId))
      .limit(1);

    return row?.plan ?? null;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to fetch user plan");
  }
}

export async function createInitialBalance({
  userId,
  plan = null,
}: {
  userId: string;
  plan?: string | null;
}): Promise<Balance> {
  try {
    const [row] = await db.insert(balance).values({ userId, plan }).returning();
    return row;
  } catch (error) {
    console.error("[createInitialBalance] DB insert failed:", error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create user balance"
    );
  }
}

export async function setBalancePlan({
  userId,
  plan,
}: {
  userId: string;
  plan: string;
}): Promise<void> {
  try {
    await db
      .update(balance)
      .set({ plan, updatedAt: new Date() })
      .where(eq(balance.userId, userId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update user plan"
    );
  }
}
