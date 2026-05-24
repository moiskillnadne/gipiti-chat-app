import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { balance, currency, transaction, user } from "@/lib/db/schema";

config({ path: ".env.local" });

/**
 * Admin: credit a user's persistent top-up balance, in MAJOR currency units.
 * Usage: npx tsx scripts/add-tokens.ts <userId> <amountMajor> [description]
 */
async function main(): Promise<void> {
  const userId = process.argv.at(2);
  const amountArg = process.argv.at(3);
  const description = process.argv.at(4);

  if (!(userId && amountArg)) {
    console.error(
      "❌ Usage: npx tsx scripts/add-tokens.ts <userId> <amountMajor> [description]"
    );
    console.error("   Example: npx tsx scripts/add-tokens.ts abc-123 500");
    process.exit(1);
  }

  const amountMajor = Number(amountArg);
  if (!Number.isFinite(amountMajor) || amountMajor <= 0) {
    console.error("❌ Amount must be a positive number (major currency units)");
    process.exit(1);
  }

  // biome-ignore lint: Forbidden non-null assertion.
  const client = postgres(process.env.POSTGRES_URL!);
  const db = drizzle(client);

  const [existingUser] = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!existingUser) {
    console.error(`❌ User not found: ${userId}`);
    await client.end();
    process.exit(1);
  }

  const [balanceRow] = await db
    .select()
    .from(balance)
    .where(eq(balance.userId, userId))
    .limit(1);

  if (!balanceRow) {
    console.error(
      `❌ No balance row for user ${userId} — they must sign up first.`
    );
    await client.end();
    process.exit(1);
  }

  const [cur] = await db
    .select({ minorUnits: currency.minorUnits })
    .from(currency)
    .where(eq(currency.code, balanceRow.currencyCode))
    .limit(1);
  const minorUnits = cur?.minorUnits ?? 2;
  const amountMinor = Math.round(amountMajor * 10 ** minorUnits);
  const newTopup = balanceRow.topupAmount + amountMinor;

  await db.transaction(async (tx) => {
    await tx
      .update(balance)
      .set({ topupAmount: newTopup, updatedAt: new Date() })
      .where(eq(balance.userId, userId));

    const [txn] = await tx
      .insert(transaction)
      .values({
        userId,
        type: "adjustment",
        currencyCode: balanceRow.currencyCode,
        pool: "topup",
        amount: amountMinor,
        subscriptionBalanceAfter: balanceRow.subscriptionAmount,
        topupBalanceAfter: newTopup,
        referenceType: "admin",
        referenceId: `manual_credit_${Date.now()}`,
        description:
          description ??
          `Manual balance credit (+${amountMajor} ${balanceRow.currencyCode})`,
      })
      .returning({ id: transaction.id });

    console.log(
      `\n✅ Credited +${amountMajor} ${balanceRow.currencyCode} to ${existingUser.email}'s top-up pool`
    );
    console.log(`   New top-up balance (minor units): ${newTopup}`);
    console.log(`   Transaction ID: ${txn.id}`);
  });

  await client.end();
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Failed to add balance:", error);
  process.exit(1);
});
