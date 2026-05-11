import { config } from "dotenv";
import { and, eq } from "drizzle-orm";
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

config({ path: ".env.local" });

const FREE_PLAN_NAME = "free";
const FREE_TOKEN_BALANCE = 30_000;

async function main() {
  const userId = process.argv.at(2);

  if (!userId) {
    console.error("❌ Usage: npx tsx scripts/assign-free-plan.ts <userId>");
    console.error(
      "   Example: npx tsx scripts/assign-free-plan.ts 4c2b7f0e-..."
    );
    process.exit(1);
  }

  const freeTier = SUBSCRIPTION_TIERS[FREE_PLAN_NAME];

  if (!freeTier) {
    console.error(
      `❌ Tier config "${FREE_PLAN_NAME}" missing from SUBSCRIPTION_TIERS`
    );
    process.exit(1);
  }

  console.log(`🔧 Assigning free plan to user: ${userId}\n`);

  // biome-ignore lint: Forbidden non-null assertion.
  const client = postgres(process.env.POSTGRES_URL!);
  const db = drizzle(client);

  const existingUsers = await db
    .select({
      id: user.id,
      email: user.email,
      currentPlan: user.currentPlan,
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

  console.log(`User:           ${existingUser.email} (${existingUser.id})`);
  console.log(`Current plan:   ${existingUser.currentPlan ?? "(none)"}`);
  console.log(
    `Current balance: ${(existingUser.tokenBalance ?? 0).toLocaleString()} tokens\n`
  );

  // Get or create free plan in DB
  const existingPlans = await db
    .select()
    .from(subscriptionPlan)
    .where(eq(subscriptionPlan.name, FREE_PLAN_NAME))
    .limit(1);

  let plan = existingPlans.at(0);

  if (plan) {
    console.log(`✅ Found existing "${FREE_PLAN_NAME}" plan: ${plan.id}`);
  } else {
    const [newPlan] = await db
      .insert(subscriptionPlan)
      .values({
        name: freeTier.name,
        displayName: freeTier.displayName,
        billingPeriod: freeTier.billingPeriod,
        billingPeriodCount: freeTier.billingPeriodCount,
        tokenQuota: freeTier.tokenQuota,
        features: freeTier.features,
        price: freeTier.price.USD.toString(),
        isTesterPlan: false,
      })
      .returning();
    plan = newPlan;
    console.log(`✅ Created "${FREE_PLAN_NAME}" plan: ${plan.id}`);
  }

  // Surface existing active subscriptions BEFORE cancellation so the user
  // can see what's about to be cancelled and which CloudPayments subscription
  // they need to cancel manually.
  const activeSubs = await db
    .select({
      id: userSubscription.id,
      planId: userSubscription.planId,
      planName: subscriptionPlan.name,
      externalSubscriptionId: userSubscription.externalSubscriptionId,
      status: userSubscription.status,
      currentPeriodEnd: userSubscription.currentPeriodEnd,
    })
    .from(userSubscription)
    .innerJoin(
      subscriptionPlan,
      eq(userSubscription.planId, subscriptionPlan.id)
    )
    .where(
      and(
        eq(userSubscription.userId, userId),
        eq(userSubscription.status, "active")
      )
    );

  if (activeSubs.length > 0) {
    console.log(`\n📋 Existing active subscriptions (${activeSubs.length}):`);
    for (const sub of activeSubs) {
      console.log(`   - ${sub.planName} (sub ${sub.id})`);
      console.log(
        `     externalSubscriptionId: ${sub.externalSubscriptionId ?? "(none)"}`
      );
      console.log(
        `     currentPeriodEnd:        ${sub.currentPeriodEnd.toISOString()}`
      );
    }
  } else {
    console.log("\n📋 No active subscriptions to cancel");
  }

  const cloudPaymentsIdsToCancel = activeSubs
    .map((s) => s.externalSubscriptionId)
    .filter((id): id is string => Boolean(id));

  // Cancel old subs + create new free sub atomically
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

  const previousBalance = existingUser.tokenBalance ?? 0;

  const newSubscriptionId = await db.transaction(async (tx) => {
    if (activeSubs.length > 0) {
      await tx
        .update(userSubscription)
        .set({ status: "cancelled", cancelledAt: now, updatedAt: now })
        .where(
          and(
            eq(userSubscription.userId, userId),
            eq(userSubscription.status, "active")
          )
        );
    }

    const [newSub] = await tx
      .insert(userSubscription)
      .values({
        userId,
        planId: plan.id,
        billingPeriod: freeTier.billingPeriod,
        billingPeriodCount: freeTier.billingPeriodCount,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        nextBillingDate: nextBilling,
        status: "active",
        cancelAtPeriodEnd: false,
        isTrial: false,
      })
      .returning({ id: userSubscription.id });

    await tx
      .update(user)
      .set({
        currentPlan: FREE_PLAN_NAME,
        tokenBalance: FREE_TOKEN_BALANCE,
        lastBalanceResetAt: now,
        updatedAt: now,
      })
      .where(eq(user.id, userId));

    await tx.insert(tokenBalanceTransaction).values({
      userId,
      type: "reset",
      amount: FREE_TOKEN_BALANCE,
      balanceAfter: FREE_TOKEN_BALANCE,
      referenceType: "admin",
      referenceId: newSub.id,
      description: `Balance reset from ${previousBalance} to ${FREE_TOKEN_BALANCE} (free plan assignment)`,
      metadata: {
        previousBalance,
        planName: FREE_PLAN_NAME,
        subscriptionId: newSub.id,
      },
    });

    return newSub.id;
  });

  console.log("\n✅ Free plan assigned");
  console.log(`   New subscription ID: ${newSubscriptionId}`);
  console.log(`   currentPeriodEnd:    ${periodEnd.toISOString()}`);
  console.log(
    `   New balance:         ${FREE_TOKEN_BALANCE.toLocaleString()} tokens`
  );

  if (cloudPaymentsIdsToCancel.length > 0) {
    console.log(
      "\n⚠️  CloudPayments subscriptions still active — cancel manually:"
    );
    for (const id of cloudPaymentsIdsToCancel) {
      console.log(`   - ${id}`);
    }
    console.log(
      "   Cancel via CloudPayments dashboard, OR use cancelSubscription() from"
    );
    console.log("   lib/payments/cloudpayments.ts to stop recurrent billing.");
  }

  await client.end();
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Failed to assign free plan:", error);
  process.exit(1);
});
