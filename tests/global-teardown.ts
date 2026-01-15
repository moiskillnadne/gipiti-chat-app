import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
// Import schema types directly
import { user } from "../lib/db/schema";
import { TEST_USER } from "./fixtures";

/**
 * Global teardown for Playwright tests
 * Cleans up test users from the database after all tests complete
 */
async function globalTeardown(): Promise<void> {
  const connectionString = process.env.POSTGRES_URL;

  if (!connectionString) {
    console.warn("POSTGRES_URL not set, skipping cleanup");
    return;
  }

  console.log("Cleaning up test database...");

  const client = postgres(connectionString);
  const db = drizzle(client);

  try {
    // Delete test user
    await db.delete(user).where(eq(user.email, TEST_USER.email));
    console.log(`Deleted test user: ${TEST_USER.email}`);
  } catch (error) {
    console.error("Failed to clean up test database:", error);
    // Don't throw - teardown failures shouldn't fail the test run
  } finally {
    await client.end();
  }
}

export default globalTeardown;
