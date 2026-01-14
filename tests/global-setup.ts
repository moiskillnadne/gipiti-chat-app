import { genSaltSync, hashSync } from "bcrypt-ts"
import { drizzle } from "drizzle-orm/postgres-js"
import { eq } from "drizzle-orm"
import postgres from "postgres"
import { TEST_USER } from "./fixtures"

// Import schema types directly (schema doesn't have server-only)
import { user } from "../lib/db/schema"

/**
 * Global setup for Playwright tests
 * Creates test users in the database before all tests run
 */
async function globalSetup(): Promise<void> {
  const connectionString = process.env.POSTGRES_URL

  if (!connectionString) {
    console.error("POSTGRES_URL environment variable is not set")
    throw new Error("Database connection string is required for tests")
  }

  console.log("Setting up test database...")

  const client = postgres(connectionString)
  const db = drizzle(client)

  try {
    // Clean up existing test user if exists
    await db.delete(user).where(eq(user.email, TEST_USER.email))
    console.log(`Cleaned up existing test user: ${TEST_USER.email}`)

    // Create test user with hashed password
    const salt = genSaltSync(10)
    const hashedPassword = hashSync(TEST_USER.password, salt)

    await db.insert(user).values({
      email: TEST_USER.email,
      password: hashedPassword,
      emailVerified: true,
      preferredLanguage: "en",
    })

    console.log(`Created test user: ${TEST_USER.email}`)
  } catch (error) {
    console.error("Failed to set up test database:", error)
    throw error
  } finally {
    // Close the database connection
    await client.end()
  }
}

export default globalSetup
