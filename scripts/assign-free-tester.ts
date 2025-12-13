import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { subscriptionPlan, user, userSubscription } from "@/lib/db/schema";
import {
  calculateNextBillingDate,
  calculatePeriodEnd,
} from "@/lib/subscription/billing-periods";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription/subscription-tiers";

config({
  path: ".env.local",
});

async function main() {
  const userId = process.argv.at(2);

  if (!userId) {
    console.error("❌ Usage: npx tsx scripts/assign-free-tester.ts <userId>");
    process.exit(1);
  }

  console.log(`🔧 Assigning FREE tester status to user: ${userId}`);

  // biome-ignore lint: Forbidden non-null assertion.
  const client = postgres(process.env.POSTGRES_URL!);
  const db = drizzle(client);

  const existingUsers = await db
    .select()
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (existingUsers.length === 0) {
    console.error(`❌ User not found: ${userId}`);
    await client.end();
    process.exit(1);
  }

  const existingUser = existingUsers.at(0);
  if (!existingUser) {
    console.error(`❌ User not found: ${userId}`);
    await client.end();
    process.exit(1);
  }

  // Set isTester flag
  if (existingUser.isTester) {
    console.log(`ℹ️ User ${existingUser.email} is already a tester`);
  } else {
    await db
      .update(user)
      .set({ isTester: true, updatedAt: new Date() })
      .where(eq(user.id, userId));
    console.log(`✅ User ${existingUser.email} marked as tester`);
  }

  // Create free tester subscription (inline logic from assignTesterPlan)
  try {
    const testerTier = SUBSCRIPTION_TIERS.tester;

    // Get or create tester plan
    const plans = await db
      .select()
      .from(subscriptionPlan)
      .where(eq(subscriptionPlan.name, "tester"))
      .limit(1);

    let plan = plans.at(0);

    if (!plan) {
      const [newPlan] = await db
        .insert(subscriptionPlan)
        .values({
          name: testerTier.name,
          displayName: testerTier.displayName.en,
          billingPeriod: testerTier.billingPeriod,
          billingPeriodCount: testerTier.billingPeriodCount,
          tokenQuota: testerTier.tokenQuota,
          features: testerTier.features,
          price: testerTier.price.RUB.toString(),
          isTesterPlan: true,
        })
        .returning();
      plan = newPlan;
      console.log("✅ Created tester plan in database");
    }

    // Create subscription
    const now = new Date();
    const periodEnd = calculatePeriodEnd(
      now,
      testerTier.billingPeriod,
      testerTier.billingPeriodCount
    );
    const nextBilling = calculateNextBillingDate(
      now,
      testerTier.billingPeriod,
      testerTier.billingPeriodCount
    );

    await db.insert(userSubscription).values({
      userId,
      planId: plan.id,
      billingPeriod: testerTier.billingPeriod,
      billingPeriodCount: testerTier.billingPeriodCount,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      nextBillingDate: nextBilling,
      status: "active",
    });

    // Update user's current plan
    await db
      .update(user)
      .set({ currentPlan: "tester" })
      .where(eq(user.id, userId));

    console.log(
      `✅ Free tester subscription created for ${existingUser.email}`
    );
    console.log("   They can now access the app without payment");
    console.log("   Subscription will auto-renew daily via cron job");
  } catch (error) {
    console.error("❌ Failed to create subscription:", error);
    await client.end();
    process.exit(1);
  }

  await client.end();
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Failed to assign free tester:", error);
  process.exit(1);
});
