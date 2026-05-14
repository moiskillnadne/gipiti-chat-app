/**
 * Migration script to convert existing users from period-based quota to balance-based system
 *
 * This script:
 * 1. Gets all users with active subscriptions
 * 2. Calculates their remaining balance based on plan quota minus used tokens
 * 3. Updates the tokenBalance column on the User table
 * 4. Records the initial balance transaction for audit trail
 *
 * Run with: npx tsx scripts/migrate-to-balance.ts
 */

import { config } from "dotenv";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  balance,
  subscriptionPlan,
  tokenBalanceTransaction,
  userSubscription,
  userTokenUsage,
} from "@/lib/db/schema";

config({
  path: ".env.local",
});

type MigrationStats = {
  total: number;
  migrated: number;
  skipped: number;
  failed: number;
};

async function main() {
  console.log("🔄 Starting token balance migration...\n");

  // biome-ignore lint: Forbidden non-null assertion.
  const client = postgres(process.env.POSTGRES_URL!);
  const db = drizzle(client);

  const stats: MigrationStats = {
    total: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
  };

  try {
    // Get all users with active subscriptions
    const activeSubscriptions = await db
      .select({
        userId: userSubscription.userId,
        subscriptionId: userSubscription.id,
        planId: userSubscription.planId,
        periodStart: userSubscription.currentPeriodStart,
        periodEnd: userSubscription.currentPeriodEnd,
        status: userSubscription.status,
      })
      .from(userSubscription)
      .where(eq(userSubscription.status, "active"));

    console.log(
      `📊 Found ${activeSubscriptions.length} active subscriptions\n`
    );
    stats.total = activeSubscriptions.length;

    for (const sub of activeSubscriptions) {
      try {
        // Get the plan to know the quota
        const plans = await db
          .select({
            tokenQuota: subscriptionPlan.tokenQuota,
            name: subscriptionPlan.name,
          })
          .from(subscriptionPlan)
          .where(eq(subscriptionPlan.id, sub.planId))
          .limit(1);

        const plan = plans[0];
        if (!plan) {
          console.log(`⚠️ Skipping user ${sub.userId}: Plan not found`);
          stats.skipped++;
          continue;
        }

        // Get current period usage
        const usages = await db
          .select({
            totalTokens: userTokenUsage.totalTokens,
          })
          .from(userTokenUsage)
          .where(
            and(
              eq(userTokenUsage.userId, sub.userId),
              eq(userTokenUsage.subscriptionId, sub.subscriptionId),
              eq(userTokenUsage.periodStart, sub.periodStart),
              eq(userTokenUsage.periodEnd, sub.periodEnd)
            )
          )
          .limit(1);

        const usedTokens = usages[0]?.totalTokens ?? 0;
        const remainingBalance = Math.max(0, plan.tokenQuota - usedTokens);

        // Check if user already has a non-zero balance (already migrated)
        const currentBalance = await db
          .select({ tokens: balance.tokens })
          .from(balance)
          .where(eq(balance.userId, sub.userId))
          .limit(1);

        if ((currentBalance[0]?.tokens ?? 0) > 0) {
          console.log(
            `⏭️ Skipping user ${sub.userId}: Already has balance (${currentBalance[0]?.tokens})`
          );
          stats.skipped++;
          continue;
        }

        // Update user's token balance
        await db
          .insert(balance)
          .values({
            userId: sub.userId,
            tokens: remainingBalance,
            updatedAt: sub.periodStart,
          })
          .onConflictDoUpdate({
            target: balance.userId,
            set: {
              tokens: remainingBalance,
              updatedAt: sub.periodStart,
            },
          });

        // Record the migration transaction for audit
        await db.insert(tokenBalanceTransaction).values({
          userId: sub.userId,
          type: "reset",
          amount: remainingBalance,
          balanceAfter: remainingBalance,
          referenceType: "migration",
          referenceId: `migration_${new Date().toISOString()}`,
          description: `Initial balance migration. Plan: ${plan.name}, Quota: ${plan.tokenQuota}, Used: ${usedTokens}, Remaining: ${remainingBalance}`,
          metadata: {
            planName: plan.name,
            subscriptionId: sub.subscriptionId,
            previousBalance: 0,
          },
        });

        console.log(
          `✅ Migrated user ${sub.userId}: ${remainingBalance} tokens (${plan.tokenQuota} quota - ${usedTokens} used)`
        );
        stats.migrated++;
      } catch (error) {
        console.error(`❌ Failed to migrate user ${sub.userId}:`, error);
        stats.failed++;
      }
    }

    // Summary
    console.log(`\n${"=".repeat(50)}`);
    console.log("📈 Migration Summary:");
    console.log(`   Total subscriptions: ${stats.total}`);
    console.log(`   Successfully migrated: ${stats.migrated}`);
    console.log(
      `   Skipped (already migrated or missing plan): ${stats.skipped}`
    );
    console.log(`   Failed: ${stats.failed}`);
    console.log("=".repeat(50));

    if (stats.failed > 0) {
      console.log(
        "\n⚠️ Some migrations failed. Please review the errors above."
      );
    } else {
      console.log("\n🎉 Migration completed successfully!");
    }
  } catch (error) {
    console.error("❌ Migration failed:", error);
    await client.end();
    process.exit(1);
  }

  await client.end();
  process.exit(stats.failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("❌ Migration failed:", error);
  process.exit(1);
});
