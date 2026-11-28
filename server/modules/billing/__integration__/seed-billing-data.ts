/**
 * Seeding helpers for the billing read tests. Transaction timestamps are
 * written as text, so a test can use microseconds, which a JavaScript `Date`
 * cannot hold.
 */
import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import { db } from "@/server/db/connection";
import type { Transaction } from "@/server/db/schema";
import { balance, user } from "@/server/db/schema";

type SeedTransactionInput = {
  userId: string;
  /** `YYYY-MM-DD HH:MM:SS[.ffffff]`, read by Postgres as a `timestamp`. */
  createdAt: string;
  type?: Transaction["type"];
  pool?: Transaction["pool"];
  amount?: number;
  subscriptionBalanceAfter?: number;
  topupBalanceAfter?: number;
  currencyCode?: string;
  chatId?: string | null;
  modelId?: string | null;
  description?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  metadata?: Record<string, unknown> | null;
  id?: string;
};

export const seedTransaction = async ({
  userId,
  createdAt,
  type = "usage_debit",
  pool = "subscription",
  amount = -100,
  subscriptionBalanceAfter = 0,
  topupBalanceAfter = 0,
  currencyCode = "RUB",
  chatId = null,
  modelId = null,
  description = null,
  referenceType = null,
  referenceId = null,
  metadata = null,
  id = randomUUID(),
}: SeedTransactionInput): Promise<string> => {
  await db.execute(
    sql`INSERT INTO "Transaction"
          ("id", "user_id", "type", "currency_code", "pool", "amount",
           "subscription_balance_after", "topup_balance_after", "chat_id",
           "model_id", "description", "reference_type", "reference_id",
           "metadata", "created_at")
        VALUES (${id}::uuid, ${userId}::uuid, ${type}::transaction_type,
                ${currencyCode}, ${pool}::balance_pool, ${amount},
                ${subscriptionBalanceAfter}, ${topupBalanceAfter},
                ${chatId}::uuid, ${modelId}, ${description},
                ${referenceType}, ${referenceId},
                ${metadata === null ? null : JSON.stringify(metadata)}::jsonb,
                ${createdAt}::timestamp)`
  );

  return id;
};

/** A user with a balance row in the given currency; the currency must exist. */
export const seedUserInCurrency = async ({
  currencyCode,
  isTester = false,
}: {
  currencyCode: string;
  isTester?: boolean;
}): Promise<string> => {
  const [created] = await db
    .insert(user)
    .values({ email: `billing-it-${randomUUID()}@example.test`, isTester })
    .returning({ id: user.id });

  await db.insert(balance).values({ userId: created.id, currencyCode });

  return created.id;
};
