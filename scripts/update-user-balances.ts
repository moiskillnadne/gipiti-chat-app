import { config } from "dotenv";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  subscriptionPlan,
  tokenBalanceTransaction,
  user,
  userSubscription,
} from "@/lib/db/schema";

config({ path: ".env.local" });

// Balance increases per plan name (difference between old and new quotas)
const BALANCE_INCREASES: Record<string, number> = {
  tester: 100_000, // 100K → 200K = +100K
  tester_paid: 100_000, // 100K → 200K = +100K
  basic_monthly: 1_000_000, // 2M → 3M = +1M
  basic_quarterly: 3_000_000, // 6M → 9M = +3M
  basic_annual: 12_000_000, // 24M → 36M = +12M
};

async function main() {
  console.log("🔄 Updating user balances for extended token limits...\n");

  // biome-ignore lint: Forbidden non-null assertion.
  const client = postgres(process.env.POSTGRES_URL!);
  const db = drizzle(client);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  // Get all active subscriptions with their plan names and user balances
  const activeSubscriptions = await db
    .select({
      userId: userSubscription.userId,
      planName: subscriptionPlan.name,
      planDisplayName: subscriptionPlan.displayName,
      currentBalance: user.tokenBalance,
    })
    .from(userSubscription)
    .innerJoin(subscriptionPlan, eq(userSubscription.planId, subscriptionPlan.id))
    .innerJoin(user, eq(userSubscription.userId, user.id))
    .where(eq(userSubscription.status, "active"));

  console.log(`Found ${activeSubscriptions.length} active subscriptions\n`);

  const referenceId = `quota_extension_${Date.now()}`;

  for (const sub of activeSubscriptions) {
    const increase = BALANCE_INCREASES[sub.planName];

    if (!increase) {
      console.log(
        `⏭️  Skipping user ${sub.userId} - plan "${sub.planName}" not in update list`
      );
      skipped++;
      continue;
    }

    try {
      const currentBalance = sub.currentBalance ?? 0;
      const newBalance = currentBalance + increase;

      // Update user's token balance
      await db
        .update(user)
        .set({
          tokenBalance: newBalance,
          updatedAt: new Date(),
        })
        .where(eq(user.id, sub.userId));

      // Record the credit transaction for audit trail
      await db.insert(tokenBalanceTransaction).values({
        userId: sub.userId,
        type: "credit",
        amount: increase,
        balanceAfter: newBalance,
        referenceType: "adjustment",
        referenceId,
        description: `Token quota extension: ${sub.planName} (+${increase.toLocaleString()} tokens)`,
        metadata: {
          planName: sub.planName,
          previousBalance: currentBalance,
        },
      });

      console.log(
        `✅ Updated user ${sub.userId} (${sub.planDisplayName}): ${currentBalance.toLocaleString()} → ${newBalance.toLocaleString()} (+${increase.toLocaleString()})`
      );
      updated++;
    } catch (error) {
      console.error(`❌ Failed to update user ${sub.userId}:`, error);
      failed++;
    }
  }

  console.log(
    `\n🎉 Done! Updated: ${updated}, Skipped: ${skipped}, Failed: ${failed}, Total: ${activeSubscriptions.length}`
  );

  await client.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("❌ Failed:", error);
  process.exit(1);
});
