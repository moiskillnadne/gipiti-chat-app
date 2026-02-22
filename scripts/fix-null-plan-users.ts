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

/**
 * One-time fix script for 6 users with current_plan = null.
 *
 * Root causes:
 * 1. isTester=true users were excluded from the free plan migration
 * 2. Users who had active subscriptions at migration time later cancelled,
 *    and cleanup-cancelled cron set currentPlan=null without assigning free plan
 *
 * Actions:
 * - vitya.ryabkov@gmail.com: SKIP (leave as-is per owner request)
 * - supchik99@gmail.com: assign tester plan (isTester=true)
 * - den.aryakhov@gmail.com: check active sub -> set currentPlan or assignFreePlan
 * - a@voroshilin.ru: check active sub -> set currentPlan or assignFreePlan
 * - vitya.ryabkov+52@gmail.com: check active sub -> set currentPlan or assignFreePlan
 * - sapronova_anna@bk.ru: check active sub -> set currentPlan or assignFreePlan
 */

const SKIP_EMAIL = "vitya.ryabkov@gmail.com";
const TESTER_EMAIL = "supchik99@gmail.com";
const FREE_PLAN_EMAILS = [
  "den.aryakhov@gmail.com",
  "a@voroshilin.ru",
  "vitya.ryabkov+52@gmail.com",
  "sapronova_anna@bk.ru",
];

async function main() {
  console.log("=== Fix null plan users ===\n");

  // biome-ignore lint: Forbidden non-null assertion.
  const client = postgres(process.env.POSTGRES_URL!);
  const db = drizzle(client);

  // First, verify which users actually have null plans
  const nullPlanUsers = await db
    .select({
      id: user.id,
      email: user.email,
      currentPlan: user.currentPlan,
      isTester: user.isTester,
      tokenBalance: user.tokenBalance,
    })
    .from(user)
    .where(isNull(user.currentPlan));

  console.log(`Found ${nullPlanUsers.length} users with null current_plan:`);
  for (const u of nullPlanUsers) {
    console.log(
      `  - ${u.email} (isTester=${u.isTester}, balance=${u.tokenBalance})`
    );
  }
  console.log();

  let fixed = 0;
  let skipped = 0;

  for (const targetUser of nullPlanUsers) {
    // Skip vitya.ryabkov@gmail.com
    if (targetUser.email === SKIP_EMAIL) {
      console.log(`[SKIP] ${targetUser.email} - skipped per owner request`);
      skipped++;
      continue;
    }

    // Assign tester plan to supchik99@gmail.com
    if (targetUser.email === TESTER_EMAIL) {
      await assignTesterPlanForUser(db, targetUser.id, targetUser.email);
      fixed++;
      continue;
    }

    // For remaining users: check for active subscription first
    if (FREE_PLAN_EMAILS.includes(targetUser.email)) {
      await fixUserWithFreePlan(db, targetUser.id, targetUser.email);
      fixed++;
      continue;
    }

    // Unknown user with null plan - log but don't touch
    console.log(
      `[UNKNOWN] ${targetUser.email} - not in expected list, skipping`
    );
    skipped++;
  }

  console.log("\n=== Summary ===");
  console.log(`  Total null plan users: ${nullPlanUsers.length}`);
  console.log(`  Fixed: ${fixed}`);
  console.log(`  Skipped: ${skipped}`);

  await client.end();
  process.exit(0);
}

async function assignTesterPlanForUser(
  // biome-ignore lint/suspicious/noExplicitAny: standalone script db type
  db: ReturnType<typeof drizzle>,
  userId: string,
  email: string
) {
  const testerTier = SUBSCRIPTION_TIERS.tester;

  // Check if already has an active subscription
  const activeSubs = await db
    .select({
      id: userSubscription.id,
      planId: userSubscription.planId,
    })
    .from(userSubscription)
    .where(
      and(
        eq(userSubscription.userId, userId),
        eq(userSubscription.status, "active")
      )
    );

  if (activeSubs.length > 0) {
    // Has active subscription - look up plan name and just set currentPlan
    const activeSub = activeSubs[0];
    const plans = await db
      .select({ name: subscriptionPlan.name })
      .from(subscriptionPlan)
      .where(eq(subscriptionPlan.id, activeSub.planId))
      .limit(1);

    const planName = plans[0]?.name ?? "tester";
    await db
      .update(user)
      .set({ currentPlan: planName, updatedAt: new Date() })
      .where(eq(user.id, userId));

    console.log(
      `[FIX] ${email} - set currentPlan="${planName}" (had active subscription)`
    );
    return;
  }

  // No active subscription - create tester plan subscription
  const plans = await db
    .select()
    .from(subscriptionPlan)
    .where(eq(subscriptionPlan.name, "tester"))
    .limit(1);

  let plan = plans[0];

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
        price: testerTier.price.toString(),
        isTesterPlan: true,
      })
      .returning();
    plan = newPlan;
  }

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

  // Get current balance for audit trail
  const currentUser = await db
    .select({ balance: user.tokenBalance })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  const previousBalance = currentUser[0]?.balance ?? 0;
  const newBalance = testerTier.tokenQuota;

  await db
    .update(user)
    .set({
      currentPlan: "tester",
      tokenBalance: newBalance,
      lastBalanceResetAt: now,
      updatedAt: now,
    })
    .where(eq(user.id, userId));

  await db.insert(tokenBalanceTransaction).values({
    userId,
    type: "reset",
    amount: newBalance - Number(previousBalance),
    balanceAfter: newBalance,
    referenceType: "migration",
    description: "Assigned tester plan via fix-null-plan-users script",
    metadata: {
      planName: "tester",
      previousBalance: Number(previousBalance),
    },
  });

  console.log(
    `[FIX] ${email} - created tester subscription + set currentPlan="tester"`
  );
}

async function fixUserWithFreePlan(
  // biome-ignore lint/suspicious/noExplicitAny: standalone script db type
  db: ReturnType<typeof drizzle>,
  userId: string,
  email: string
) {
  const freeTier = SUBSCRIPTION_TIERS.free;

  // Check if already has an active subscription
  const activeSubs = await db
    .select({
      id: userSubscription.id,
      planId: userSubscription.planId,
    })
    .from(userSubscription)
    .where(
      and(
        eq(userSubscription.userId, userId),
        eq(userSubscription.status, "active")
      )
    );

  if (activeSubs.length > 0) {
    // Has active subscription - look up plan name and just set currentPlan
    const activeSub = activeSubs[0];
    const plans = await db
      .select({ name: subscriptionPlan.name })
      .from(subscriptionPlan)
      .where(eq(subscriptionPlan.id, activeSub.planId))
      .limit(1);

    const planName = plans[0]?.name ?? "free";
    await db
      .update(user)
      .set({ currentPlan: planName, updatedAt: new Date() })
      .where(eq(user.id, userId));

    console.log(
      `[FIX] ${email} - set currentPlan="${planName}" (had active subscription)`
    );
    return;
  }

  // No active subscription - create free plan subscription
  const plans = await db
    .select()
    .from(subscriptionPlan)
    .where(eq(subscriptionPlan.name, "free"))
    .limit(1);

  let plan = plans[0];

  if (!plan) {
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
  }

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

  await db.insert(userSubscription).values({
    userId,
    planId: plan.id,
    billingPeriod: freeTier.billingPeriod,
    billingPeriodCount: freeTier.billingPeriodCount,
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    nextBillingDate: nextBilling,
    status: "active",
  });

  // Get current balance for audit trail
  const currentUser = await db
    .select({ balance: user.tokenBalance })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  const previousBalance = currentUser[0]?.balance ?? 0;
  const newBalance = freeTier.tokenQuota;

  await db
    .update(user)
    .set({
      currentPlan: "free",
      tokenBalance: newBalance,
      lastBalanceResetAt: now,
      updatedAt: now,
    })
    .where(eq(user.id, userId));

  await db.insert(tokenBalanceTransaction).values({
    userId,
    type: "reset",
    amount: newBalance - Number(previousBalance),
    balanceAfter: newBalance,
    referenceType: "migration",
    description: "Assigned free plan via fix-null-plan-users script",
    metadata: {
      planName: "free",
      previousBalance: Number(previousBalance),
    },
  });

  console.log(
    `[FIX] ${email} - created free subscription + set currentPlan="free"`
  );
}

main().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
