import { expect, type Page, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
// Import schema types directly (schema doesn't have server-only)
import { chat, user } from "../../lib/db/schema";
import { TEST_URLS, TEST_USER, TIMEOUTS } from "../fixtures";
import { LoginPage } from "../pages/auth";

const CHAT_URL_REGEX = /\/chat/;
const INPUT_TEST_ID = "multimodal-input";

/**
 * Longer than React's nested-update limit (50) twice over, so an input that
 * triggers extra synchronous re-renders per keystroke hits it at least once.
 */
const BURST_LENGTH = 120;

/**
 * Inserts `count` characters with one `input` event each, all inside a single
 * task — the way dictation, text expanders and automation tools type. Manual
 * typing gives every keystroke its own task and never stresses this path.
 */
async function insertCharactersInOneTask(
  page: Page,
  count: number
): Promise<void> {
  await page.getByTestId(INPUT_TEST_ID).evaluate((element, total) => {
    const textarea = element as HTMLTextAreaElement;
    const setNativeValue = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value"
    )?.set;
    for (let index = 0; index < total; index++) {
      setNativeValue?.call(textarea, `${textarea.value}x`);
      textarea.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          data: "x",
          inputType: "insertText",
        })
      );
    }
  }, count);
}

/**
 * Creates an empty chat owned by the test user. Drafts are keyed by chat id,
 * and `/chat` mints a new id on every load, so a draft can only survive a
 * reload on an existing chat. The chats go away with the user in teardown.
 */
async function createTestUserChat(title: string): Promise<string> {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error("POSTGRES_URL is required to create a test chat");
  }

  const client = postgres(connectionString);
  try {
    const db = drizzle(client);
    const [testUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, TEST_USER.email));
    if (!testUser) {
      throw new Error(`Test user ${TEST_USER.email} is missing`);
    }

    const [createdChat] = await db
      .insert(chat)
      .values({ createdAt: new Date(), title, userId: testUser.id })
      .returning({ id: chat.id });
    return createdChat.id;
  } finally {
    await client.end();
  }
}

test.describe("Chat input", () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(TEST_USER.email, TEST_USER.password);
    await page.waitForURL(CHAT_URL_REGEX, {
      timeout: TIMEOUTS.formSubmission,
    });
    await page.goto(TEST_URLS.chat);
    await expect(page.getByTestId(INPUT_TEST_ID)).toBeVisible();
  });

  test("keeps every character of a burst of input events", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await insertCharactersInOneTask(page, BURST_LENGTH);

    await expect(page.getByTestId(INPUT_TEST_ID)).toHaveValue(
      "x".repeat(BURST_LENGTH)
    );
    expect(pageErrors).toEqual([]);
  });

  test("restores the unsent draft after a reload", async ({ page }) => {
    const chatId = await createTestUserChat("Draft after reload");
    const draft = "черновик, который нельзя потерять";
    await page.goto(`/chat/${chatId}`);

    await page.getByTestId(INPUT_TEST_ID).fill(draft);
    await page.reload();

    await expect(page.getByTestId(INPUT_TEST_ID)).toHaveValue(draft);
  });

  test("keeps a separate draft for each chat", async ({ page }) => {
    const firstChatId = await createTestUserChat("First draft chat");
    const secondChatId = await createTestUserChat("Second draft chat");
    const draft = "черновик первого чата";

    await page.goto(`/chat/${firstChatId}`);
    await page.getByTestId(INPUT_TEST_ID).fill(draft);
    await page.goto(`/chat/${secondChatId}`);
    await expect(page.getByTestId(INPUT_TEST_ID)).toHaveValue("");
    await page.goto(`/chat/${firstChatId}`);

    await expect(page.getByTestId(INPUT_TEST_ID)).toHaveValue(draft);
  });
});
