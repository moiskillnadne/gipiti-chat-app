import { config } from "dotenv";
import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  subscriptionPlan,
  tokenBalanceTransaction,
  user,
  userSubscription,
} from "@/lib/db/schema";
import {
  calculateNextBillingDate,
  calculatePeriodEnd,
} from "@/lib/subscription/billing-periods";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription/subscription-tiers";

config({
  path: ".env.local",
});

async function main() {
  console.log(
    "Starting migration: assign free plan to users without active subscriptions"
  );

  // biome-ignore lint: Forbidden non-null assertion.
  const client = postgres(process.env.POSTGRES_URL!);
  const db = drizzle(client);

  const freeTier = SUBSCRIPTION_TIERS.free;

  // Get or create free plan in DB
  const plans = await db
    .select()
    .from(subscriptionPlan)
    .where(eq(subscriptionPlan.name, "free"))
    .limit(1);

  let plan = plans.at(0);

  if (plan) {
    console.log("Free plan already exists in database");
  } else {
    const [newPlan] = await db
      .insert(subscriptionPlan)
      .values({
        name: freeTier.name,
        displayName: freeTier.displayName.en,
        billingPeriod: freeTier.billingPeriod,
        billingPeriodCount: freeTier.billingPeriodCount,
        tokenQuota: freeTier.tokenQuota,
        features: freeTier.features,
        price: freeTier.price.toString(),
        isTesterPlan: false,
      })
      .returning();
    plan = newPlan;
    console.log("Created free plan in database");
  }

  // Find users without an active subscription who are not testers
  const usersWithoutSubscription = await db
    .select({
      id: user.id,
      email: user.email,
      currentPlan: user.currentPlan,
    })
    .from(user)
    .leftJoin(
      userSubscription,
      and(
        eq(userSubscription.userId, user.id),
        eq(userSubscription.status, "active")
      )
    )
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
      const periodEnd = calculatePeriodEnd(
        now,
        freeTier.billingPeriod,
        freeTier.billingPeriodCount
      );
      const nextBilling = calculateNextBillingDate(
        now,
        freeTier.billingPeriod,
        freeTier.billingPeriodCount
      );

      // Create subscription
      await db.insert(userSubscription).values({
        userId: targetUser.id,
        planId: plan.id,
        billingPeriod: freeTier.billingPeriod,
        billingPeriodCount: freeTier.billingPeriodCount,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        nextBillingDate: nextBilling,
        status: "active",
      });

      // Update user's current plan
      await db
        .update(user)
        .set({ currentPlan: "free" })
        .where(eq(user.id, targetUser.id));

      // Reset token balance
      const newBalance = freeTier.tokenQuota;
      const currentUser = await db
        .select({ balance: user.tokenBalance })
        .from(user)
        .where(eq(user.id, targetUser.id))
        .limit(1);

      const previousBalance = currentUser[0]?.balance ?? 0;

      await db
        .update(user)
        .set({
          tokenBalance: newBalance,
          lastBalanceResetAt: now,
          updatedAt: now,
        })
        .where(eq(user.id, targetUser.id));

      await db.insert(tokenBalanceTransaction).values({
        userId: targetUser.id,
        type: "reset",
        amount: newBalance - Number(previousBalance),
        balanceAfter: newBalance,
        referenceType: "migration",
        description:
          "Migrated to free plan via migrate-users-to-free-plan script",
        metadata: {
          planName: "free",
          previousBalance: Number(previousBalance),
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
