import { config } from "dotenv";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { FREE_TIER_ENTITLEMENTS } from "@/lib/ai/entitlements";
import {
  balance,
  tokenBalanceTransaction,
  user,
  userSubscription,
} from "@/lib/db/schema";

config({ path: ".env.local" });

const FREE_PLAN_NAME = "free";

async function main() {
  const userId = process.argv.at(2);

  if (!userId) {
    console.error("❌ Usage: npx tsx scripts/assign-free-plan.ts <userId>");
    console.error(
      "   Example: npx tsx scripts/assign-free-plan.ts 4c2b7f0e-..."
    );
    process.exit(1);
  }

  const freeBalance = FREE_TIER_ENTITLEMENTS.tier_1.tokenBonus;

  console.log(`🔧 Assigning free plan to user: ${userId}\n`);

  // biome-ignore lint: Forbidden non-null assertion.
  const client = postgres(process.env.POSTGRES_URL!);
  const db = drizzle(client);

  const existingUsers = await db
    .select({
      id: user.id,
      email: user.email,
      plan: balance.plan,
      tokens: balance.tokens,
    })
    .from(user)
    .leftJoin(balance, eq(balance.userId, user.id))
    .where(eq(user.id, userId))
    .limit(1);

  const existingUser = existingUsers.at(0);

  if (!existingUser) {
    console.error(`❌ User not found: ${userId}`);
    await client.end();
    process.exit(1);
  }

  console.log(`User:           ${existingUser.email} (${existingUser.id})`);
  console.log(`Current plan:   ${existingUser.plan ?? "(none)"}`);
  console.log(
    `Current balance: ${(existingUser.tokens ?? 0).toLocaleString()} tokens\n`
  );

  // Free is not a subscription. Cancel any existing active subscriptions
  // (e.g. tester_paid, basic_*) so the user is clearly on the free track.
  const activeSubs = await db
    .select({
      id: userSubscription.id,
      externalSubscriptionId: userSubscription.externalSubscriptionId,
      status: userSubscription.status,
      currentPeriodEnd: userSubscription.currentPeriodEnd,
    })
    .from(userSubscription)
    .where(
      and(
        eq(userSubscription.userId, userId),
        eq(userSubscription.status, "active")
      )
    );

  if (activeSubs.length > 0) {
    console.log(`\n📋 Existing active subscriptions (${activeSubs.length}):`);
    for (const sub of activeSubs) {
      console.log(`   - sub ${sub.id}`);
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

  const now = new Date();
  const previousBalance = existingUser.tokens ?? 0;

  await db.transaction(async (tx) => {
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

    await tx
      .update(balance)
      .set({
        plan: FREE_PLAN_NAME,
        tokens: freeBalance,
        lastBalanceResetAt: now,
        updatedAt: now,
      })
      .where(eq(balance.userId, userId));

    await tx.insert(tokenBalanceTransaction).values({
      userId,
      type: "reset",
      amount: freeBalance,
      balanceAfter: freeBalance,
      referenceType: "admin",
      description: `Balance reset from ${previousBalance} to ${freeBalance} (free plan assignment)`,
      metadata: {
        previousBalance,
        planName: FREE_PLAN_NAME,
      },
    });
  });

  console.log("\n✅ Free plan assigned");
  console.log(`   New balance: ${freeBalance.toLocaleString()} tokens`);

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
