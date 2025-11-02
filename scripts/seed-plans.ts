import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { SUBSCRIPTION_TIERS } from "@/lib/ai/subscription-tiers";
import { subscriptionPlan } from "@/lib/db/schema";

config({
  path: ".env.local",
});

async function main() {
  console.log("🌱 Seeding subscription plans...");

  // biome-ignore lint: Forbidden non-null assertion.
  const client = postgres(process.env.POSTGRES_URL!);
  const db = drizzle(client);

  let created = 0;
  let updated = 0;

  for (const [key, tier] of Object.entries(SUBSCRIPTION_TIERS)) {
    try {
      // Check if plan exists
      const existing = await db
        .select()
        .from(subscriptionPlan)
        .where(eq(subscriptionPlan.name, tier.name))
        .limit(1);

      if (existing.length > 0) {
        // Update existing plan
        await db
          .update(subscriptionPlan)
          .set({
            displayName: tier.displayName,
            billingPeriod: tier.billingPeriod,
            tokenQuota: tier.tokenQuota,
            features: tier.features as any,
            price: tier.price.toString(),
            isTesterPlan: tier.isTesterPlan || false,
            updatedAt: new Date(),
          })
          .where(eq(subscriptionPlan.id, existing[0].id));

        console.log(`✅ Updated plan: ${tier.displayName}`);
        updated++;
      } else {
        // Create new plan
        await db.insert(subscriptionPlan).values({
          name: tier.name,
          displayName: tier.displayName,
          billingPeriod: tier.billingPeriod,
          tokenQuota: tier.tokenQuota,
          features: tier.features as any,
          price: tier.price.toString(),
          isTesterPlan: tier.isTesterPlan || false,
        });

        console.log(`✅ Created plan: ${tier.displayName}`);
        created++;
      }
    } catch (error) {
      console.error(`❌ Failed to seed plan ${tier.displayName}:`, error);
    }
  }

  console.log(
    `\n🎉 Seeding complete! Created: ${created}, Updated: ${updated}`
  );

  await client.end();
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Seeding failed:", error);
  process.exit(1);
});
