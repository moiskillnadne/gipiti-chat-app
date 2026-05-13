import { and, eq, sql } from "drizzle-orm";
import { dbTx } from "@/lib/db/queries";
import { tokenBalanceTransaction, user } from "@/lib/db/schema";

export type BonusReason = "email_verified_bonus" | "survey_completed_bonus";

type CreditBonusInput = {
  userId: string;
  reason: BonusReason;
  tokens: number;
  imageGens: number;
  videoGens: number;
};

export type CreditBonusResult =
  | { credited: false; reason: "already_granted" }
  | { credited: true; transactionId: string; newBalance: number };

/**
 * Idempotently credit a milestone bonus (e.g. email verification, survey completion).
 *
 * The idempotency key is (userId, type='credit', referenceType=reason). A second call
 * with the same reason is a no-op and returns `{ credited: false, reason: 'already_granted' }`.
 */
export async function creditBonus({
  userId,
  reason,
  tokens,
  imageGens,
  videoGens,
}: CreditBonusInput): Promise<CreditBonusResult> {
  if (tokens < 0 || imageGens < 0 || videoGens < 0) {
    throw new Error("creditBonus: bonus amounts must be non-negative");
  }

  return await dbTx.transaction(async (tx) => {
    const existing = await tx
      .select({ id: tokenBalanceTransaction.id })
      .from(tokenBalanceTransaction)
      .where(
        and(
          eq(tokenBalanceTransaction.userId, userId),
          eq(tokenBalanceTransaction.type, "credit"),
          eq(tokenBalanceTransaction.referenceType, reason)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return { credited: false, reason: "already_granted" };
    }

    const [currentRow] = await tx
      .select({ balance: user.tokenBalance })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!currentRow) {
      throw new Error(`creditBonus: user ${userId} not found`);
    }

    const previousBalance = currentRow.balance;
    const newBalance = previousBalance + tokens;

    await tx
      .update(user)
      .set({
        tokenBalance: newBalance,
        imageGenerationsLeft: sql`${user.imageGenerationsLeft} + ${imageGens}`,
        videoGenerationsLeft: sql`${user.videoGenerationsLeft} + ${videoGens}`,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));

    const [txnRow] = await tx
      .insert(tokenBalanceTransaction)
      .values({
        userId,
        type: "credit",
        amount: tokens,
        balanceAfter: newBalance,
        referenceType: reason,
        description: `Bonus credited: ${reason}`,
        metadata: { previousBalance, imageGens, videoGens },
      })
      .returning({ id: tokenBalanceTransaction.id });

    return { credited: true, transactionId: txnRow.id, newBalance };
  });
}
