import { getMessageByErrorCode } from "@/lib/errors";
import { expect, test } from "../fixtures";
import { generateRandomTestUser } from "../helpers";
import { AuthPage } from "../pages/auth";
import { ChatPage } from "../pages/chat";

test.describe
  .serial("Authentication gates", () => {
    test("Redirect unauthenticated visitors to the login page", async ({
      page,
    }) => {
      const response = await page.goto("/");

      if (!response) {
        throw new Error("Failed to load page");
      }

      let request = response.request();

      const chain: string[] = [];

      while (request) {
        chain.unshift(request.url());
        request = request.redirectedFrom();
      }

      expect(chain).toEqual([
        "http://localhost:3000/",
        "http://localhost:3000/login?callbackUrl=http%3A%2F%2Flocalhost%3A3000%2F",
      ]);
    });

    test("Allow navigating to /login when not authenticated", async ({
      page,
    }) => {
      await page.goto("/login");
      await page.waitForURL("/login");
      await expect(page).toHaveURL("/login");
    });

    test("Allow navigating to /register when not authenticated", async ({
      page,
    }) => {
      await page.goto("/register");
      await page.waitForURL("/register");
      await expect(page).toHaveURL("/register");
    });
  });

test.describe
  .serial("Login and Registration", () => {
    let authPage: AuthPage;

    const testUser = generateRandomTestUser();

    test.beforeEach(({ page }) => {
      authPage = new AuthPage(page);
    });

    test("Register new account", async () => {
      await authPage.register(testUser.email, testUser.password);
      await authPage.expectToastToContain("Account created successfully!");
    });

    test("Register new account with existing email", async () => {
      await authPage.register(testUser.email, testUser.password);
      await authPage.expectToastToContain("Account already exists!");
    });

    test("Log into account that exists", async ({ page }) => {
      await authPage.login(testUser.email, testUser.password);

      await page.waitForURL("/");
      await expect(page.getByPlaceholder("Send a message...")).toBeVisible();
    });

    test("Display user email in user menu", async ({ page }) => {
      await authPage.login(testUser.email, testUser.password);

      await page.waitForURL("/");
      await expect(page.getByPlaceholder("Send a message...")).toBeVisible();

      const userEmail = await page.getByTestId("user-email");
      await expect(userEmail).toHaveText(testUser.email);
    });

    test("Log out as authenticated user", async () => {
      await authPage.logout(testUser.email, testUser.password);
    });

    test("Log out is available for authenticated users", async ({ page }) => {
      await authPage.login(testUser.email, testUser.password);
      await page.waitForURL("/");

      authPage.openSidebar();

      const userNavButton = page.getByTestId("user-nav-button");
      await expect(userNavButton).toBeVisible();

      await userNavButton.click();
      const userNavMenu = page.getByTestId("user-nav-menu");
      await expect(userNavMenu).toBeVisible();

      const authMenuItem = page.getByTestId("user-nav-item-auth");
      await expect(authMenuItem).toContainText("Sign out");
    });

    test("Do not navigate to /register for authenticated users", async ({
      page,
    }) => {
      await authPage.login(testUser.email, testUser.password);
      await page.waitForURL("/");

      await page.goto("/register");
      await expect(page).toHaveURL("/");
    });

    test("Do not navigate to /login for authenticated users", async ({
      page,
    }) => {
      await authPage.login(testUser.email, testUser.password);
      await page.waitForURL("/");

      await page.goto("/login");
      await expect(page).toHaveURL("/");
    });
  });

test.describe("Entitlements", () => {
  let chatPage: ChatPage;

  test.beforeEach(({ page }) => {
    chatPage = new ChatPage(page);
  });

  test("Authenticated user cannot send more than 100 messages/day", async () => {
    test.fixme();
    await chatPage.createNewChat();

    for (let i = 0; i < 100; i++) {
      await chatPage.sendUserMessage("Why is the sky blue?");
      await chatPage.isGenerationComplete();
    }

    await chatPage.sendUserMessage("Why is the sky blue?");
    await chatPage.expectToastToContain(
      getMessageByErrorCode("rate_limit:chat")
    );
  });
});
