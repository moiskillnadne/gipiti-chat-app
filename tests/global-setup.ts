import { chromium, type FullConfig } from "@playwright/test";
import { genSaltSync, hashSync } from "bcrypt-ts";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
// Import schema types directly (schema doesn't have server-only)
import { user } from "../lib/db/schema";
import { TEST_URLS, TEST_USER } from "./fixtures";
import { LoginPage } from "./pages/auth";

const CHAT_URL_REGEX = /\/chat/;

/**
 * Generous ceiling for the one-off warm-up navigation: a cold Turbopack
 * compile of `/login` + `/chat` takes ~30s on a laptop and longer on a 2-vCPU CI
 * runner. This bound only exists so a broken server fails fast-ish instead of
 * hanging the whole run.
 */
const WARM_UP_TIMEOUT_MS = 180_000;

const DEFAULT_BASE_URL = `http://localhost:${process.env.PORT || 3000}`;

/**
 * Global setup for Playwright tests
 * Creates test users in the database before all tests run, then warms up the
 * dev server so the first test does not pay for route compilation.
 */
async function globalSetup(config: FullConfig): Promise<void> {
  await seedTestUser();
  await warmUpAuthenticatedRoutes(resolveBaseUrl(config));
}

async function seedTestUser(): Promise<void> {
  const connectionString = process.env.POSTGRES_URL;

  if (!connectionString) {
    console.error("POSTGRES_URL environment variable is not set");
    throw new Error("Database connection string is required for tests");
  }

  console.log("Setting up test database...");

  const client = postgres(connectionString);
  const db = drizzle(client);

  try {
    // Clean up existing test user if exists
    await db.delete(user).where(eq(user.email, TEST_USER.email));
    console.log(`Cleaned up existing test user: ${TEST_USER.email}`);

    // Create test user with hashed password
    const salt = genSaltSync(10);
    const hashedPassword = hashSync(TEST_USER.password, salt);

    await db.insert(user).values({
      email: TEST_USER.email,
      password: hashedPassword,
      emailVerified: true,
    });

    console.log(`Created test user: ${TEST_USER.email}`);
  } catch (error) {
    console.error("Failed to set up test database:", error);
    throw error;
  } finally {
    // Close the database connection
    await client.end();
  }
}

/**
 * The suite runs against `next dev`, which compiles each route on first
 * request. `/chat` is the heaviest route in the app, and anonymous requests to
 * it are redirected by `proxy.ts` before the page is ever compiled, so the
 * first *authenticated* navigation is the one that pays for the compile. On CI
 * that cold compile exceeds the 15s login-redirect timeout, which made the
 * first two login tests to reach `/chat` time out on every main run.
 *
 * Logging in once here, before any test timer starts, moves that cost out of
 * the tests. The session is thrown away with the browser.
 */
async function warmUpAuthenticatedRoutes(baseURL: string): Promise<void> {
  console.log(`Warming up ${TEST_URLS.login} and ${TEST_URLS.chat}...`);
  const startedAt = Date.now();

  const browser = await chromium.launch();

  try {
    const page = await browser.newPage({ baseURL });
    const loginPage = new LoginPage(page);

    // Not `loginPage.goto()`: that waits with the short per-test navigation
    // timeout, and `/login` itself is cold here too.
    await page.goto(TEST_URLS.login);
    await loginPage.emailInput.waitFor({
      state: "visible",
      timeout: WARM_UP_TIMEOUT_MS,
    });
    await loginPage.login(TEST_USER.email, TEST_USER.password);
    await page.waitForURL(CHAT_URL_REGEX, { timeout: WARM_UP_TIMEOUT_MS });
    await page.waitForLoadState("load");

    console.log(`Warm-up finished in ${Date.now() - startedAt}ms`);
  } catch (error) {
    console.error("Failed to warm up the dev server:", error);
    throw error;
  } finally {
    await browser.close();
  }
}

function resolveBaseUrl(config: FullConfig): string {
  const configuredBaseUrl = config.projects.find(
    (project) => typeof project.use.baseURL === "string"
  )?.use.baseURL;

  return configuredBaseUrl ?? DEFAULT_BASE_URL;
}

export default globalSetup;
