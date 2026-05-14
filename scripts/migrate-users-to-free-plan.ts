import { config } from "dotenv";
import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { FREE_TIER_ENTITLEMENTS } from "@/lib/ai/entitlements";
import {
  balance,
  tokenBalanceTransaction,
  user,
  userSubscription,
} from "@/lib/db/schema";

config({
  path: ".env.local",
});

async function main() {
  console.log(
    "Starting migration: ensure users without active subscriptions are on free plan"
  );

  // biome-ignore lint: Forbidden non-null assertion.
  const client = postgres(process.env.POSTGRES_URL!);
  const db = drizzle(client);

  const tier1 = FREE_TIER_ENTITLEMENTS.tier_1;
  const freeBalance = tier1.tokenBonus;

  // Find users without an active subscription who are not testers
  const usersWithoutSubscription = await db
    .select({
      id: user.id,
      email: user.email,
      currentTokens: balance.tokens,
    })
    .from(user)
    .leftJoin(
      userSubscription,
      and(
        eq(userSubscription.userId, user.id),
        eq(userSubscription.status, "active")
      )
    )
    .leftJoin(balance, eq(balance.userId, user.id))
    .where(and(isNull(userSubscription.id), eq(user.isTester, false)));

  console.log(
    `Found ${usersWithoutSubscription.length} users without active subscriptions`
  );

  if (usersWithoutSubscription.length === 0) {
    console.log("No users to migrate. Done.");
    await client.end();
    process.exit(0);
  }

  let migrated = 0;
  let failed = 0;

  for (const targetUser of usersWithoutSubscription) {
    try {
      const now = new Date();
      const previousBalance = Number(targetUser.currentTokens ?? 0);

      await db
        .insert(balance)
        .values({
          userId: targetUser.id,
          plan: "free",
          tokens: freeBalance,
          imageGeneration: tier1.imageBonus,
          videoGeneration: tier1.videoBonus,
          webSearches: tier1.searchQuota,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: balance.userId,
          set: {
            plan: "free",
            tokens: freeBalance,
            imageGeneration: tier1.imageBonus,
            videoGeneration: tier1.videoBonus,
            webSearches: tier1.searchQuota,
            updatedAt: now,
          },
        });

      await db.insert(tokenBalanceTransaction).values({
        userId: targetUser.id,
        type: "reset",
        amount: freeBalance - previousBalance,
        balanceAfter: freeBalance,
        referenceType: "migration",
        description:
          "Migrated to free plan via migrate-users-to-free-plan script",
        metadata: {
          planName: "free",
          previousBalance,
        },
      });

      migrated++;
      console.log(
        `[${migrated}/${usersWithoutSubscription.length}] ` +
          `Migrated ${targetUser.email} to free plan`
      );
    } catch (error) {
      failed++;
      console.error(`Failed to migrate user ${targetUser.email}:`, error);
    }
  }

  console.log("\nMigration complete:");
  console.log(`  Total users found: ${usersWithoutSubscription.length}`);
  console.log(`  Successfully migrated: ${migrated}`);
  console.log(`  Failed: ${failed}`);

  await client.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
