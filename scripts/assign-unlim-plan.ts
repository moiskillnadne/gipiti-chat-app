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

const UNLIM_PLAN_NAME = "unlim";

async function main() {
  const userId = process.argv.at(2);

  if (!userId) {
    console.error("❌ Usage: npx tsx scripts/assign-unlim-plan.ts <userId>");
    console.error(
      "   Example: npx tsx scripts/assign-unlim-plan.ts 4c2b7f0e-..."
    );
    process.exit(1);
  }

  const unlimTier = SUBSCRIPTION_TIERS[UNLIM_PLAN_NAME];

  if (!unlimTier) {
    console.error(
      `❌ Tier config "${UNLIM_PLAN_NAME}" missing from SUBSCRIPTION_TIERS`
    );
    process.exit(1);
  }

  console.log(`🔧 Assigning unlim plan to user: ${userId}\n`);

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

  // Get or create unlim plan in DB
  const existingPlans = await db
    .select()
    .from(subscriptionPlan)
    .where(eq(subscriptionPlan.name, UNLIM_PLAN_NAME))
    .limit(1);

  let plan = existingPlans.at(0);

  if (plan) {
    console.log(`✅ Found existing "${UNLIM_PLAN_NAME}" plan: ${plan.id}`);
  } else {
    const [newPlan] = await db
      .insert(subscriptionPlan)
      .values({
        name: unlimTier.name,
        displayName: unlimTier.displayName.en,
        billingPeriod: unlimTier.billingPeriod,
        billingPeriodCount: unlimTier.billingPeriodCount,
        tokenQuota: unlimTier.tokenQuota,
        features: unlimTier.features,
        price: unlimTier.price.USD.toString(),
        isTesterPlan: false,
      })
      .returning();
    plan = newPlan;
    console.log(`✅ Created "${UNLIM_PLAN_NAME}" plan: ${plan.id}`);
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

  // Cancel old subs + create new unlim sub atomically
  const now = new Date();
  const periodEnd = calculatePeriodEnd(
    now,
    unlimTier.billingPeriod,
    unlimTier.billingPeriodCount
  );
  const nextBilling = calculateNextBillingDate(
    now,
    unlimTier.billingPeriod,
    unlimTier.billingPeriodCount
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
        billingPeriod: unlimTier.billingPeriod,
        billingPeriodCount: unlimTier.billingPeriodCount,
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
        currentPlan: UNLIM_PLAN_NAME,
        tokenBalance: unlimTier.tokenQuota,
        lastBalanceResetAt: now,
        updatedAt: now,
      })
      .where(eq(user.id, userId));

    await tx.insert(tokenBalanceTransaction).values({
      userId,
      type: "reset",
      amount: unlimTier.tokenQuota,
      balanceAfter: unlimTier.tokenQuota,
      referenceType: "admin",
      referenceId: newSub.id,
      description: `Balance reset from ${previousBalance} to ${unlimTier.tokenQuota} (unlim plan assignment)`,
      metadata: {
        previousBalance,
        planName: UNLIM_PLAN_NAME,
        subscriptionId: newSub.id,
      },
    });

    return newSub.id;
  });

  console.log("\n✅ Unlim plan assigned");
  console.log(`   New subscription ID: ${newSubscriptionId}`);
  console.log(`   currentPeriodEnd:    ${periodEnd.toISOString()}`);
  console.log(
    `   New balance:         ${unlimTier.tokenQuota.toLocaleString()} tokens`
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
  console.error("❌ Failed to assign unlim plan:", error);
  process.exit(1);
});
