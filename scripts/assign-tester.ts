import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { user } from "@/lib/db/schema";

config({
  path: ".env.local",
});

async function main() {
  const userId = process.argv.at(2);

  if (!userId) {
    console.error("❌ Usage: npx tsx scripts/assign-tester.ts <userId>");
    process.exit(1);
  }

  console.log(`🔧 Assigning tester status to user: ${userId}`);

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

  if (existingUser.isTester) {
    console.log(`ℹ️ User ${existingUser.email} is already a tester`);
    await client.end();
    process.exit(0);
  }

  await db
    .update(user)
    .set({ isTester: true, updatedAt: new Date() })
    .where(eq(user.id, userId));

  console.log(`✅ User ${existingUser.email} is now a tester`);
  console.log(
    "   They will see the paid tester plan (5 RUB/day) on subscribe page"
  );

  await client.end();
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Failed to assign tester:", error);
  process.exit(1);
});
