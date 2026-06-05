import { config } from "dotenv";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { balance, transaction, user, userSubscription } from "@/lib/db/schema";

config({ path: ".env.local" });

/**
 * Admin: move a user to the free state — cancel active subscriptions and clear
 * the subscription balance pool. The persistent top-up pool is preserved.
 * Usage: npx tsx scripts/assign-free-plan.ts <userId>
 */
async function main(): Promise<void> {
  const userId = process.argv.at(2);

  if (!userId) {
    console.error("❌ Usage: npx tsx scripts/assign-free-plan.ts <userId>");
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

  const activeSubs = await db
    .select({
      id: userSubscription.id,
      externalSubscriptionId: userSubscription.externalSubscriptionId,
    })
    .from(userSubscription)
    .where(
      and(
        eq(userSubscription.userId, userId),
        eq(userSubscription.status, "active")
      )
    );

  const [balanceRow] = await db
    .select()
    .from(balance)
    .where(eq(balance.userId, userId))
    .limit(1);

  const now = new Date();

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

    if (balanceRow) {
      const previousSubscription = balanceRow.subscriptionAmount;
      if (previousSubscription !== 0) {
        await tx
          .update(balance)
          .set({ subscriptionAmount: 0, updatedAt: now })
          .where(eq(balance.userId, userId));

        await tx.insert(transaction).values({
          userId,
          type: "adjustment",
          currencyCode: balanceRow.currencyCode,
          pool: "subscription",
          amount: -previousSubscription,
          subscriptionBalanceAfter: 0,
          topupBalanceAfter: balanceRow.topupAmount,
          referenceType: "admin",
          description: "Free plan assignment (subscription pool cleared)",
          metadata: { previousSubscriptionAmount: previousSubscription },
        });
      }
    } else {
      await tx
        .insert(balance)
        .values({ userId, currencyCode: "RUB" })
        .onConflictDoNothing({ target: balance.userId });
    }
  });

  console.log(`\n✅ Free state assigned to ${existingUser.email}`);
  console.log("   Subscription pool cleared; top-up balance preserved.");

  const cloudPaymentsIds = activeSubs
    .map((sub) => sub.externalSubscriptionId)
    .filter((id): id is string => Boolean(id));

  if (cloudPaymentsIds.length > 0) {
    console.log(
      "\n⚠️  CloudPayments subscriptions still active — cancel manually:"
    );
    for (const id of cloudPaymentsIds) {
      console.log(`   - ${id}`);
    }
  }

  await client.end();
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Failed to assign free plan:", error);
  process.exit(1);
});
