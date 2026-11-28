import { randomUUID } from "node:crypto";

import { expect, type Locator, type Page, test } from "@playwright/test";
import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
// Import schema types directly (schema doesn't have server-only)
import { prompt } from "@/server/db/schema";
import { TEST_USER, TIMEOUTS } from "../fixtures";
import { waitForToast } from "../helpers";
import { LoginPage } from "../pages/auth";

const CHAT_URL_REGEX = /\/chat/;
const PROMPTS_URL = "/prompts";
const SEARCH_PLACEHOLDER_REGEX = /Опишите задачу/;
const FAVORITE_LABEL = "В избранное";
const EXISTING_MODEL_ID = "grok-4.5";
const V1_PROMPTS_PATH = "/api/v1/prompts";
const V1_FAVORITES_PATH = "/api/v1/me/favorite-prompts";
const FAVORITE_ERROR_TEXT = "Не удалось обновить избранное";
const V1_FAVORITE_ITEM_GLOB = "**/api/v1/me/favorite-prompts/*";
const V1_FAVORITE_LIST_GLOB = "**/api/v1/me/favorite-prompts";
const LEGACY_PROMPTS_PATH = "/api/prompts";

type SeededPrompt = { key: string; title: string };

const openDatabase = () => {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error("POSTGRES_URL is required to seed prompts");
  }
  const client = postgres(connectionString);
  return { client, db: drizzle(client) };
};

/** Inserts two active prompts whose titles share a token no catalogue prompt has. */
async function seedPrompts(searchTerm: string): Promise<SeededPrompt[]> {
  const seeded: SeededPrompt[] = ["first", "second"].map((label) => ({
    key: `e2e-${searchTerm.replace(" ", "-")}-${label}`.toLowerCase(),
    title: `${searchTerm} ${label}`,
  }));
  const { client, db } = openDatabase();
  try {
    await db.insert(prompt).values(
      seeded.map(({ key, title }) => ({
        key,
        title,
        category: "text",
        modelId: EXISTING_MODEL_ID,
        body: `Body of ${title}`,
        tags: ["e2e"],
      }))
    );
  } finally {
    await client.end();
  }
  return seeded;
}

/** Favourites of the seeded prompts go away with them (cascade). */
async function removePrompts(keys: string[]): Promise<void> {
  const { client, db } = openDatabase();
  try {
    await db.delete(prompt).where(inArray(prompt.key, keys));
  } finally {
    await client.end();
  }
}

/** A promise the test resolves by hand, to hold a routed request. */
const createGate = (): { opened: Promise<void>; open: () => void } => {
  const gate = Promise.withResolvers<void>();
  return { opened: gate.promise, open: () => gate.resolve() };
};

const cardOf = (page: Page, title: string): Locator =>
  page.getByRole("button", { name: title }).first();

const starOf = (card: Locator): Locator =>
  card.getByRole("button", { name: FAVORITE_LABEL });

async function openLibraryShowing(
  page: Page,
  searchTerm: string,
  seeded: SeededPrompt[]
): Promise<void> {
  await page.goto(PROMPTS_URL);
  // Search by the shared token so the cards are on the first page whatever
  // the size of the real catalogue.
  await page.getByPlaceholder(SEARCH_PLACEHOLDER_REGEX).fill(searchTerm);
  for (const { title } of seeded) {
    await expect(cardOf(page, title)).toBeVisible();
  }
}

test.describe("Prompt library on /api/v1", () => {
  let searchTerm = "";
  let seeded: SeededPrompt[] = [];

  test.beforeEach(async ({ page }) => {
    searchTerm = `E2E ${randomUUID().slice(0, 8)}`;
    seeded = await seedPrompts(searchTerm);

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(TEST_USER.email, TEST_USER.password);
    await page.waitForURL(CHAT_URL_REGEX, {
      timeout: TIMEOUTS.formSubmission,
    });
  });

  test.afterEach(async () => {
    await removePrompts(seeded.map(({ key }) => key));
  });

  test("lists, stars and unstars prompts, surviving reloads, without legacy calls", async ({
    page,
  }) => {
    const requestedPaths: string[] = [];
    page.on("request", (request) => {
      requestedPaths.push(new URL(request.url()).pathname);
    });
    const [target, other] = seeded;

    await openLibraryShowing(page, searchTerm, seeded);
    await expect(starOf(cardOf(page, target.title))).toHaveAttribute(
      "aria-pressed",
      "false"
    );

    const added = page.waitForResponse(
      (response) =>
        response.url().includes(V1_FAVORITES_PATH) &&
        response.request().method() === "PUT"
    );
    await starOf(cardOf(page, target.title)).click();
    await added;

    await page.reload();
    await openLibraryShowing(page, searchTerm, seeded);
    await expect(starOf(cardOf(page, target.title))).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(starOf(cardOf(page, other.title))).toHaveAttribute(
      "aria-pressed",
      "false"
    );

    const removed = page.waitForResponse(
      (response) =>
        response.url().includes(V1_FAVORITES_PATH) &&
        response.request().method() === "DELETE"
    );
    await starOf(cardOf(page, target.title)).click();
    await removed;

    await page.reload();
    await openLibraryShowing(page, searchTerm, seeded);
    await expect(starOf(cardOf(page, target.title))).toHaveAttribute(
      "aria-pressed",
      "false"
    );

    expect(requestedPaths).toContain(V1_PROMPTS_PATH);
    expect(requestedPaths).toContain(V1_FAVORITES_PATH);
    const legacyPaths = requestedPaths.filter(
      (path) =>
        path === LEGACY_PROMPTS_PATH ||
        path.startsWith(`${LEGACY_PROMPTS_PATH}/`)
    );
    expect(legacyPaths).toEqual([]);
  });

  test("rolls the star back and shows a toast when starring fails", async ({
    page,
  }) => {
    const [target] = seeded;
    await openLibraryShowing(page, searchTerm, seeded);

    // Hold the PUT, so the optimistic state can be seen, and the favourites
    // refetch that follows a failure, so only the rollback can unpress the star.
    const put = createGate();
    const refetch = createGate();
    await page.route(V1_FAVORITE_ITEM_GLOB, async (route) => {
      if (route.request().method() !== "PUT") {
        await route.fallback();
        return;
      }
      await put.opened;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          defined: false,
          code: "INTERNAL_SERVER_ERROR",
          status: 500,
          message: "Internal error",
        }),
      });
    });
    await page.route(V1_FAVORITE_LIST_GLOB, async (route) => {
      await refetch.opened;
      await route.fallback();
    });

    try {
      await starOf(cardOf(page, target.title)).click();
      // The optimistic write: pressed while the request is still held.
      await expect(starOf(cardOf(page, target.title))).toHaveAttribute(
        "aria-pressed",
        "true"
      );

      put.open();

      // The rollback: unpressed while the refetch is still held.
      await waitForToast(page, FAVORITE_ERROR_TEXT);
      await expect(starOf(cardOf(page, target.title))).toHaveAttribute(
        "aria-pressed",
        "false"
      );
    } finally {
      // Free held handlers first, so unrouting does not wait on them.
      put.open();
      refetch.open();
      await page.unrouteAll({ behavior: "ignoreErrors" });
    }
  });
});
