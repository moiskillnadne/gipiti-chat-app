import { config } from "dotenv";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { subscription, subscriptionPrice } from "@/lib/db/schema";
import { SUBSCRIPTION_SEEDS } from "@/lib/subscription/subscription-tiers";

config({ path: ".env.local" });

// All seeded currencies use 2 minor units.
const MINOR_UNITS = 2;

/**
 * Seed the Subscription catalog + per-currency prices from SUBSCRIPTION_SEEDS.
 * Prices are stored in minor units; the credited subscription-pool amount on
 * renewal equals the price (1:1). Idempotent.
 */
async function main(): Promise<void> {
  console.log("🌱 Seeding subscriptions...");

  // biome-ignore lint: Forbidden non-null assertion.
  const client = postgres(process.env.POSTGRES_URL!);
  const db = drizzle(client);

  for (const seed of SUBSCRIPTION_SEEDS) {
    const [existing] = await db
      .select()
      .from(subscription)
      .where(eq(subscription.code, seed.code))
      .limit(1);

    let subscriptionId: string;
    if (existing) {
      await db
        .update(subscription)
        .set({
          displayName: seed.displayName,
          billingPeriod: seed.billingPeriod,
          billingPeriodCount: seed.billingPeriodCount,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(subscription.id, existing.id));
      subscriptionId = existing.id;
    } else {
      const [created] = await db
        .insert(subscription)
        .values({
          code: seed.code,
          displayName: seed.displayName,
          billingPeriod: seed.billingPeriod,
          billingPeriodCount: seed.billingPeriodCount,
          isActive: true,
        })
        .returning({ id: subscription.id });
      subscriptionId = created.id;
    }

    for (const [currencyCode, major] of Object.entries(seed.prices)) {
      if (major == null) {
        continue;
      }
      const priceMinor = Math.round(major * 10 ** MINOR_UNITS);

      const [existingPrice] = await db
        .select({ id: subscriptionPrice.id })
        .from(subscriptionPrice)
        .where(
          and(
            eq(subscriptionPrice.subscriptionId, subscriptionId),
            eq(subscriptionPrice.currencyCode, currencyCode)
          )
        )
        .limit(1);

      if (existingPrice) {
        await db
          .update(subscriptionPrice)
          .set({ price: priceMinor, isActive: true, updatedAt: new Date() })
          .where(eq(subscriptionPrice.id, existingPrice.id));
      } else {
        await db.insert(subscriptionPrice).values({
          subscriptionId,
          currencyCode,
          price: priceMinor,
          isActive: true,
        });
      }

      console.log(
        `✅ ${seed.code} [${currencyCode}]: ${priceMinor} minor units`
      );
    }
  }

  console.log(
    `\n🎉 Seeding complete! ${SUBSCRIPTION_SEEDS.length} subscriptions.`
  );
  await client.end();
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Subscription seeding failed:", error);
  process.exit(1);
});
