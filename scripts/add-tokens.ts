import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { tokenBalanceTransaction, user } from "@/lib/db/schema";

config({ path: ".env.local" });

async function main() {
  const userId = process.argv.at(2);
  const amountArg = process.argv.at(3);
  const description = process.argv.at(4);

  if (!userId || !amountArg) {
    console.error(
      "❌ Usage: npx tsx scripts/add-tokens.ts <userId> <amount> [description]"
    );
    console.error("   Example: npx tsx scripts/add-tokens.ts abc-123 1000000");
    console.error(
      '   Example: npx tsx scripts/add-tokens.ts abc-123 500000 "Bonus tokens"'
    );
    process.exit(1);
  }

  const amount = Number(amountArg);

  if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
    console.error("❌ Amount must be a positive integer");
    process.exit(1);
  }

  // biome-ignore lint: Forbidden non-null assertion.
  const client = postgres(process.env.POSTGRES_URL!);
  const db = drizzle(client);

  const existingUsers = await db
    .select({
      id: user.id,
      email: user.email,
      tokenBalance: user.tokenBalance,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  const existingUser = existingUsers.at(0);

  if (!existingUser) {
    console.error(`❌ User not found: ${userId}`);
    await client.end();
    process.exit(1);
  }

  const currentBalance = existingUser.tokenBalance ?? 0;
  const newBalance = currentBalance + amount;

  console.log(`\nUser: ${existingUser.email} (${existingUser.id})`);
  console.log(`Current balance: ${currentBalance.toLocaleString()} tokens`);
  console.log(`Crediting: +${amount.toLocaleString()} tokens`);

  const referenceId = `manual_credit_${Date.now()}`;

  await db.transaction(async (tx) => {
    await tx
      .update(user)
      .set({
        tokenBalance: newBalance,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));

    const [transaction] = await tx
      .insert(tokenBalanceTransaction)
      .values({
        userId,
        type: "credit",
        amount,
        balanceAfter: newBalance,
        referenceType: "adjustment",
        referenceId,
        description:
          description ??
          `Manual token credit (+${amount.toLocaleString()} tokens)`,
        metadata: {
          previousBalance: currentBalance,
        },
      })
      .returning({ id: tokenBalanceTransaction.id });

    console.log("\n✅ Tokens credited successfully");
    console.log(`   Previous balance: ${currentBalance.toLocaleString()}`);
    console.log(`   Credited: +${amount.toLocaleString()}`);
    console.log(`   New balance: ${newBalance.toLocaleString()}`);
    console.log(`   Transaction ID: ${transaction.id}`);
  });

  await client.end();
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Failed to add tokens:", error);
  process.exit(1);
});
