import { randomUUID } from "node:crypto";

import { expect, type Page, test } from "@playwright/test";
import { genSaltSync, hashSync } from "bcrypt-ts";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
// Import schema types directly (schema doesn't have server-only)
import { chat, user } from "@/server/db/schema";
import { TIMEOUTS } from "../fixtures";
import { waitForToast } from "../helpers";
import { LoginPage } from "../pages/auth";

const CHAT_URL_REGEX = /\/chat/;
const PAGE_SIZE = 20;
// Two full pages and one more, so the last page holds a single chat.
const SEEDED_CHAT_COUNT = PAGE_SIZE * 2 + 1;
const CHAT_LINK_SELECTOR = 'a[href^="/chat/"]';
const SHOW_SIDEBAR_LABEL = "Показать боковую панель";
const END_OF_HISTORY_TEXT = "Вы достигли конца истории чатов.";
const EMPTY_HISTORY_TEXT = "Ваши разговоры появятся здесь";
const DELETE_ERROR_TEXT = "Не удалось удалить чат";
const SERVER_ERROR_TEXT = "На нашей стороне что-то пошло не так";
const V1_CHATS_PATH = "/api/v1/chats";
const LEGACY_HISTORY_PATH = "/api/history";
const LEGACY_CHAT_PATH = "/api/chat";
const SEED_PASSWORD = "TestPassword123!";

type SeededChat = { id: string; title: string };

type RecordedRequest = { method: string; pathname: string; search: string };

const openDatabase = () => {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error("POSTGRES_URL is required to seed chats");
  }
  const client = postgres(connectionString);
  return { client, db: drizzle(client) };
};

/**
 * Creates a verified account of its own (so deleting every chat cannot touch
 * the shared test user's chats) and gives it numbered chats. Chat 1 is the
 * newest; creation times are one second apart so the order is fixed.
 */
async function seedAccountWithChats(
  email: string,
  titlePrefix: string
): Promise<SeededChat[]> {
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
    const newestTime = Date.now();
    const rows = Array.from({ length: SEEDED_CHAT_COUNT }, (_, index) => ({
      id: randomUUID(),
      title: `${titlePrefix} ${String(index + 1).padStart(2, "0")}`,
      userId: account.id,
      createdAt: new Date(newestTime - index * 1000),
    }));
    await db.insert(chat).values(rows);
    return rows.map(({ id, title }) => ({ id, title }));
  } finally {
    await client.end();
  }
}

/** The account's chats go with it (cascade). */
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

const recordRequests = (page: Page): RecordedRequest[] => {
  const recorded: RecordedRequest[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    recorded.push({
      method: request.method(),
      pathname: url.pathname,
      search: url.search,
    });
  });
  return recorded;
};

/** The sidebar starts closed on a desktop window; the history loads on scroll only when it is on screen. */
async function openHistory(page: Page, path: string): Promise<void> {
  await page.goto(path);
  const toggle = page.getByTestId("sidebar-toggle-button").first();
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute("aria-label")) === SHOW_SIDEBAR_LABEL) {
    await toggle.click();
  }
}

const chatLinkOf = (page: Page, title: string) =>
  page.getByRole("link", { name: title, exact: true });

const sidebarChatHrefs = (page: Page): Promise<string[]> =>
  page
    .locator(CHAT_LINK_SELECTOR)
    .evaluateAll((links) =>
      links.map((link) => link.getAttribute("href") ?? "")
    );

/**
 * Scrolls the history down until its end-of-list text shows. A page loads when
 * the sentinel below the list enters the viewport, so each round leaves the
 * bottom and comes back to it.
 */
async function loadWholeHistory(page: Page): Promise<void> {
  await expect(async () => {
    await page.locator('[data-sidebar="content"]').evaluate((element) => {
      element.scrollTop = 0;
    });
    await page.locator('[data-sidebar="content"]').evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(page.getByText(END_OF_HISTORY_TEXT)).toBeVisible({
      timeout: 1500,
    });
  }).toPass({ timeout: TIMEOUTS.formSubmission });
}

async function deleteChatFromMenu(page: Page, title: string): Promise<void> {
  const item = page
    .locator("li")
    .filter({ has: chatLinkOf(page, title) })
    .first();
  await item.hover();
  await item.getByRole("button", { name: "More" }).click();
  await page.getByRole("menuitem", { name: "Удалить" }).click();
  await page.getByRole("button", { name: "Продолжить" }).click();
}

test.describe("Chat history on /api/v1", () => {
  let email = "";
  let seeded: SeededChat[] = [];

  test.beforeEach(async ({ page }) => {
    const runToken = randomUUID().slice(0, 8);
    email = `e2e-chat-history-${runToken}@example.com`;
    seeded = await seedAccountWithChats(email, `E2E ${runToken} chat`);

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

  test("pages the list, deletes one chat and all of them, without legacy calls", async ({
    page,
  }) => {
    const requests = recordRequests(page);
    await openHistory(page, "/");
    const [newestChat, , , , fifthChat] = seeded;
    const lastChat = seeded.at(-1);

    // First page: newest first, and nothing from the second page yet.
    await expect(chatLinkOf(page, newestChat.title)).toBeVisible();
    await expect(chatLinkOf(page, seeded[PAGE_SIZE - 1].title)).toBeAttached();
    const firstPageHrefs = await sidebarChatHrefs(page);
    expect(firstPageHrefs).toHaveLength(PAGE_SIZE);
    expect(firstPageHrefs.slice(0, PAGE_SIZE)).toEqual(
      seeded.slice(0, PAGE_SIZE).map(({ id }) => `/chat/${id}`)
    );

    // Scrolling loads the rest, with no chat listed twice.
    await loadWholeHistory(page);
    await expect(chatLinkOf(page, lastChat?.title ?? "")).toBeAttached();
    const allHrefs = await sidebarChatHrefs(page);
    expect(allHrefs).toEqual(seeded.map(({ id }) => `/chat/${id}`));
    expect(new Set(allHrefs).size).toBe(SEEDED_CHAT_COUNT);

    // One chat: gone at once, and still gone after a reload.
    await deleteChatFromMenu(page, fifthChat.title);
    await expect(chatLinkOf(page, fifthChat.title)).toHaveCount(0);
    await waitForToast(page, "Чат успешно удалён");
    await openHistory(page, page.url());
    await expect(chatLinkOf(page, newestChat.title)).toBeVisible();
    await loadWholeHistory(page);
    await expect(chatLinkOf(page, fifthChat.title)).toHaveCount(0);
    expect(await sidebarChatHrefs(page)).toHaveLength(SEEDED_CHAT_COUNT - 1);

    // All chats: confirmed in the dialog, the list is empty after a reload.
    await page.getByRole("button", { name: "Удалить все чаты" }).click();
    await page
      .getByRole("button", { name: "Удалить все", exact: true })
      .click();
    await expect(page.getByText(EMPTY_HISTORY_TEXT)).toBeVisible();
    await openHistory(page, page.url());
    await expect(page.getByText(EMPTY_HISTORY_TEXT)).toBeVisible();
    await expect(page.locator(CHAT_LINK_SELECTOR)).toHaveCount(0);

    expect(
      requests.filter(
        ({ method, pathname }) => method === "GET" && pathname === V1_CHATS_PATH
      ).length
    ).toBeGreaterThanOrEqual(2);
    expect(
      requests.some(
        ({ pathname, search }) =>
          pathname === V1_CHATS_PATH && search.includes("cursor=")
      )
    ).toBe(true);
    expect(
      requests.some(
        ({ method, pathname }) =>
          method === "DELETE" && pathname === `${V1_CHATS_PATH}/${fifthChat.id}`
      )
    ).toBe(true);
    expect(
      requests.some(
        ({ method, pathname, search }) =>
          method === "DELETE" &&
          pathname === V1_CHATS_PATH &&
          search.includes("confirm=true")
      )
    ).toBe(true);
    const legacyRequests = requests.filter(
      ({ method, pathname }) =>
        pathname === LEGACY_HISTORY_PATH ||
        (method === "DELETE" && pathname === LEGACY_CHAT_PATH)
    );
    expect(legacyRequests).toEqual([]);
  });

  test("puts a chat back with a toast when deleting it fails", async ({
    page,
  }) => {
    await openHistory(page, "/");
    const [target] = seeded;
    await expect(chatLinkOf(page, target.title)).toBeVisible();

    // Hold the DELETE, so the optimistic removal can be seen, and the list
    // refetch that follows a failure, so only the rollback can bring the chat back.
    const deleteGate = createGate();
    const refetchGate = createGate();
    await page.route(`**${V1_CHATS_PATH}/*`, async (route) => {
      if (route.request().method() !== "DELETE") {
        await route.fallback();
        return;
      }
      await deleteGate.opened;
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
    await page.route(
      (url) => url.pathname === V1_CHATS_PATH,
      async (route) => {
        await refetchGate.opened;
        await route.fallback();
      }
    );

    try {
      await deleteChatFromMenu(page, target.title);
      // The optimistic removal: gone while the request is still held.
      await expect(chatLinkOf(page, target.title)).toHaveCount(0);

      deleteGate.open();

      // The rollback: back, with the error shown, while the refetch is held.
      await waitForToast(page, DELETE_ERROR_TEXT);
      await waitForToast(page, SERVER_ERROR_TEXT);
      await expect(chatLinkOf(page, target.title)).toBeVisible();
    } finally {
      // Free held handlers first, so unrouting does not wait on them.
      deleteGate.open();
      refetchGate.open();
      await page.unrouteAll({ behavior: "ignoreErrors" });
    }
  });

  test("loads the next page when every loaded chat is gone", async ({
    page,
  }) => {
    // The state a user reaches by deleting every chat of the loaded pages one
    // by one while older ones remain: the server is stubbed to answer with an
    // empty first page and a cursor. Driving twenty UI deletes would not
    // reliably end in this state, because the history sentinel loads the next
    // page as soon as the shrinking list brings it into view.
    const olderChat = {
      id: randomUUID(),
      title: "E2E older chat",
      createdAt: new Date().toISOString(),
    };
    await page.route(
      (url) => url.pathname === V1_CHATS_PATH,
      async (route) => {
        const hasCursor = new URL(route.request().url()).searchParams.has(
          "cursor"
        );
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            hasCursor
              ? { items: [olderChat], nextCursor: null }
              : { items: [], nextCursor: "stubbed-cursor" }
          ),
        });
      }
    );

    await openHistory(page, "/");

    await expect(chatLinkOf(page, olderChat.title)).toBeVisible();
    await expect(page.getByText(END_OF_HISTORY_TEXT)).toBeVisible();
  });

  test("shows an error line when the first page fails, then the list", async ({
    page,
  }) => {
    let readCount = 0;
    await page.route(
      (url) => url.pathname === V1_CHATS_PATH,
      async (route) => {
        readCount += 1;
        if (readCount > 1) {
          await route.fallback();
          return;
        }
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
      }
    );

    await openHistory(page, "/");

    await expect(
      page.getByRole("alert").filter({ hasText: SERVER_ERROR_TEXT })
    ).toBeVisible();
    // SWR retries on its own and the list replaces the error line.
    await expect(chatLinkOf(page, seeded[0].title)).toBeVisible();
    await expect(
      page.getByRole("alert").filter({ hasText: SERVER_ERROR_TEXT })
    ).toHaveCount(0);
  });
});
