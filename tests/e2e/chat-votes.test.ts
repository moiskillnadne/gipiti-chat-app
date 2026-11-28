import { randomUUID } from "node:crypto";

import { expect, type Locator, type Page, test } from "@playwright/test";
import { genSaltSync, hashSync } from "bcrypt-ts";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
// Import schema types directly (schema doesn't have server-only)
import { chat, message, user } from "@/server/db/schema";
import { TIMEOUTS } from "../fixtures";
import { waitForToast } from "../helpers";
import { LoginPage } from "../pages/auth";

const CHAT_URL_REGEX = /\/chat/;
const ANSWER_COUNT = 7;
// SWR's `focusThrottleInterval` (5000) plus a margin.
const FOCUS_THROTTLE_MS = 5500;
const SEED_PASSWORD = "TestPassword123!";
const V1_VOTE_GLOB = "**/api/v1/chats/*/messages/*/vote";
const UPVOTE_ERROR_TEXT = "Не удалось отметить ответ как хороший";
const DOWNVOTE_ERROR_TEXT = "Не удалось отметить ответ как плохой";
const SERVER_ERROR_TEXT = "На нашей стороне что-то пошло не так";

const openDatabase = () => {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error("POSTGRES_URL is required to seed chats");
  }
  const client = postgres(connectionString);
  return { client, db: drizzle(client) };
};

const textMessage = (
  chatId: string,
  role: "user" | "assistant",
  text: string,
  createdAt: Date
) => ({
  id: randomUUID(),
  chatId,
  role,
  parts: [{ type: "text", text }],
  attachments: [],
  createdAt,
});

/**
 * An account of its own with one chat: a user message and two answers, and no
 * votes. Returns the chat id.
 */
async function seedChatWithoutVotes(email: string): Promise<string> {
  const { client, db } = openDatabase();
  try {
    const [account] = await db
      .insert(user)
      .values({
        email,
        password: hashSync(SEED_PASSWORD, genSaltSync(10)),
        emailVerified: true,
      })
      .returning({ id: user.id });
    const chatId = randomUUID();
    const startTime = Date.now() - 120_000;
    await db.insert(chat).values({
      id: chatId,
      title: "E2E votes",
      userId: account.id,
      createdAt: new Date(startTime),
    });
    const turns = Array.from({ length: ANSWER_COUNT }, (_, index) => [
      textMessage(
        chatId,
        "user",
        `Question ${index + 1}`,
        new Date(startTime + (index * 2 + 1) * 1000)
      ),
      textMessage(
        chatId,
        "assistant",
        `Answer ${index + 1}`,
        new Date(startTime + (index * 2 + 2) * 1000)
      ),
    ]);
    await db.insert(message).values(turns.flat());
    return chatId;
  } finally {
    await client.end();
  }
}

/** The account's chat and messages go with it (cascade). */
async function removeAccount(email: string): Promise<void> {
  const { client, db } = openDatabase();
  try {
    await db.delete(user).where(eq(user.email, email));
  } finally {
    await client.end();
  }
}

/** A promise the test resolves by hand, to hold a routed request. */
const createGate = (): { opened: Promise<void>; open: () => void } => {
  const gate = Promise.withResolvers<void>();
  return { opened: gate.promise, open: () => gate.resolve() };
};

const upvoteOfFirstAnswer = (page: Page): Locator =>
  page.getByTestId("message-upvote").first();

const downvoteOfFirstAnswer = (page: Page): Locator =>
  page.getByTestId("message-downvote").first();

async function openChat(page: Page, chatId: string): Promise<void> {
  await page.goto(`/chat/${chatId}`);
  await expect(upvoteOfFirstAnswer(page)).toBeVisible();
}

test.describe("Votes on /api/v1", () => {
  let email = "";
  let chatId = "";

  test.beforeEach(async ({ page }) => {
    email = `e2e-chat-votes-${randomUUID().slice(0, 8)}@example.com`;
    chatId = await seedChatWithoutVotes(email);

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(email, SEED_PASSWORD);
    await page.waitForURL(CHAT_URL_REGEX, {
      timeout: TIMEOUTS.formSubmission,
    });
  });

  test.afterEach(async () => {
    await removeAccount(email);
  });

  test("shows the first vote of a chat at once and after a reload", async ({
    page,
  }) => {
    await openChat(page, chatId);
    await expect(upvoteOfFirstAnswer(page)).toBeEnabled();

    await upvoteOfFirstAnswer(page).click();
    await expect(upvoteOfFirstAnswer(page)).toBeDisabled();
    await expect(downvoteOfFirstAnswer(page)).toBeEnabled();

    await openChat(page, chatId);
    await expect(upvoteOfFirstAnswer(page)).toBeDisabled();
  });

  test("changes an upvote to a downvote without a reload", async ({ page }) => {
    await openChat(page, chatId);
    await upvoteOfFirstAnswer(page).click();
    await expect(upvoteOfFirstAnswer(page)).toBeDisabled();

    await downvoteOfFirstAnswer(page).click();

    await expect(downvoteOfFirstAnswer(page)).toBeDisabled();
    await expect(upvoteOfFirstAnswer(page)).toBeEnabled();
  });

  test("goes back to the earlier state with a toast when voting fails", async ({
    page,
  }) => {
    await openChat(page, chatId);

    // Hold the PUT, so the optimistic state can be seen.
    const gate = createGate();
    await page.route(V1_VOTE_GLOB, async (route) => {
      await gate.opened;
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

    try {
      await upvoteOfFirstAnswer(page).click();
      await expect(upvoteOfFirstAnswer(page)).toBeDisabled();

      gate.open();

      await waitForToast(page, UPVOTE_ERROR_TEXT);
      await waitForToast(page, SERVER_ERROR_TEXT);
      await expect(upvoteOfFirstAnswer(page)).toBeEnabled();
    } finally {
      gate.open();
      await page.unrouteAll({ behavior: "ignoreErrors" });
    }
  });
});

test.describe("Votes while the votes read is in flight", () => {
  let email = "";
  let chatId = "";

  test.beforeEach(async ({ page }) => {
    email = `e2e-chat-votes-${randomUUID().slice(0, 8)}@example.com`;
    chatId = await seedChatWithoutVotes(email);
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(email, SEED_PASSWORD);
    await page.waitForURL(CHAT_URL_REGEX, { timeout: TIMEOUTS.formSubmission });
  });

  test.afterEach(async () => {
    await removeAccount(email);
  });

  test("keeps a vote made before the first votes read answers", async ({
    page,
  }) => {
    const readGate = createGate();
    await page.route("**/api/v1/chats/*/votes", async (route) => {
      await readGate.opened;
      await route.fallback();
    });

    try {
      await page.goto(`/chat/${chatId}`);
      await expect(upvoteOfFirstAnswer(page)).toBeVisible();
      await upvoteOfFirstAnswer(page).click();
      await expect(upvoteOfFirstAnswer(page)).toBeDisabled();
      await waitForToast(page, "Ответ отмечен как хороший");

      readGate.open();

      await page.waitForTimeout(1500);
      await expect(upvoteOfFirstAnswer(page)).toBeDisabled();
    } finally {
      readGate.open();
      await page.unrouteAll({ behavior: "ignoreErrors" });
    }
  });

  test("keeps a vote when a revalidation reads the list before the vote commits", async ({
    page,
  }) => {
    await openChat(page, chatId);
    await expect(upvoteOfFirstAnswer(page)).toBeEnabled();
    // SWR revalidates on focus at most once in five seconds.
    await page.waitForTimeout(FOCUS_THROTTLE_MS);

    // Every read from now on answers with the list as it was before the vote.
    await page.route("**/api/v1/chats/*/votes", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [] }),
      });
    });
    const gate = createGate();
    await page.route(V1_VOTE_GLOB, async (route) => {
      await gate.opened;
      await route.fallback();
    });

    try {
      await upvoteOfFirstAnswer(page).click();
      await expect(upvoteOfFirstAnswer(page)).toBeDisabled();
      // A focus revalidation that starts while the PUT is still held.
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await expect(upvoteOfFirstAnswer(page)).toBeEnabled();

      gate.open();

      await waitForToast(page, "Ответ отмечен как хороший");
      await expect(upvoteOfFirstAnswer(page)).toBeDisabled();
    } finally {
      gate.open();
      await page.unrouteAll({ behavior: "ignoreErrors" });
    }
  });

  test("leaves no vote when two quick votes both fail", async ({ page }) => {
    await openChat(page, chatId);

    // Both PUTs are held, each by its own gate; the second is only sent once
    // the first has answered. The list read is held too, so only the cache
    // writes can decide what the buttons show.
    const gates = [createGate(), createGate()];
    let putCount = 0;
    await page.route(V1_VOTE_GLOB, async (route) => {
      const gate = gates[putCount];
      putCount += 1;
      await gate.opened;
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
    const readGate = createGate();
    await page.route("**/api/v1/chats/*/votes", async (route) => {
      await readGate.opened;
      await route.fallback();
    });

    try {
      await upvoteOfFirstAnswer(page).click();
      await expect(upvoteOfFirstAnswer(page)).toBeDisabled();
      await downvoteOfFirstAnswer(page).click();
      await expect(downvoteOfFirstAnswer(page)).toBeDisabled();

      // The first request fails while the second is still waiting: the
      // downvote the user just chose stays on screen.
      gates[0].open();
      await waitForToast(page, UPVOTE_ERROR_TEXT);
      await expect(downvoteOfFirstAnswer(page)).toBeDisabled();

      gates[1].open();
      await waitForToast(page, DOWNVOTE_ERROR_TEXT);
      await expect(upvoteOfFirstAnswer(page)).toBeEnabled();
      await expect(downvoteOfFirstAnswer(page)).toBeEnabled();
    } finally {
      for (const gate of gates) {
        gate.open();
      }
      readGate.open();
      await page.unrouteAll({ behavior: "ignoreErrors" });
    }
  });
});
