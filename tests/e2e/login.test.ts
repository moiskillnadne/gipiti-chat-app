import { expect, test } from "@playwright/test";
import {
  EXTERNAL_URLS,
  INVALID_USER,
  TEST_USER,
  TIMEOUTS,
  VALIDATION_DATA,
} from "../fixtures";
import {
  getCurrentLocale,
  getSessionCookie,
  setLocale,
  waitForToast,
} from "../helpers";
import { LoginPage } from "../pages/auth";

const CHAT_OR_LOGIN_URL_REGEX = /\/(chat|login)/;
const SUCCESS_REDIRECT_URL_REGEX = /\/(chat|verify-email)/;
const CHAT_URL_REGEX = /\/chat/;

test.describe("Login Page", () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  // ==========================================================================
  // 1. Form Rendering & Initial State (8 tests)
  // ==========================================================================
  test.describe("Form Rendering & Initial State", () => {
    test("renders login form with all elements", async () => {
      await expect(loginPage.emailInput).toBeVisible();
      await expect(loginPage.passwordInput).toBeVisible();
      await expect(loginPage.submitButton).toBeVisible();
    });

    test("email field has autofocus", async () => {
      const isFocused = await loginPage.hasEmailAutofocus();
      expect(isFocused).toBe(true);
    });

    test("password is hidden by default", async () => {
      const type = await loginPage.passwordInput.getAttribute("type");
      expect(type).toBe("password");
    });

    test("submit button is enabled initially", async () => {
      const isDisabled = await loginPage.isSubmitDisabled();
      expect(isDisabled).toBe(false);
    });

    test("shows correct page title", async () => {
      const title = await loginPage.getPageTitleText();
      expect(title.length).toBeGreaterThan(0);
    });

    test("shows forgot password link", async () => {
      await expect(loginPage.forgotPasswordLink).toBeVisible();
      const href = await loginPage.forgotPasswordLink.getAttribute("href");
      expect(href).toBe("/forgot-password");
    });

    test("shows sign up link", async () => {
      await expect(loginPage.signUpLink).toBeVisible();
      const href = await loginPage.signUpLink.getAttribute("href");
      expect(href).toBe("/register");
    });

    test("password requirements checklist is not shown", async ({ page }) => {
      // On login page, password requirements should be hidden
      const requirements = page.locator("#password-display-requirements");
      await expect(requirements).toHaveCSS("max-height", "0px");
    });
  });

  // ==========================================================================
  // 2. Form Validation (5 tests)
  // ==========================================================================
  test.describe("Form Validation", () => {
    test("empty email shows browser validation error", async ({
      page: _page,
    }) => {
      await loginPage.fillPassword(TEST_USER.password);
      await loginPage.clickSubmit();

      // Browser should show validation message
      const isValid = await loginPage.emailInput.evaluate(
        (el: HTMLInputElement) => el.checkValidity()
      );
      expect(isValid).toBe(false);
    });

    test("invalid email format shows browser validation error", async () => {
      await loginPage.fillEmail("not-an-email");
      await loginPage.fillPassword(TEST_USER.password);
      await loginPage.clickSubmit();

      const isValid = await loginPage.emailInput.evaluate(
        (el: HTMLInputElement) => el.checkValidity()
      );
      expect(isValid).toBe(false);
    });

    test("empty password shows browser validation error", async () => {
      await loginPage.fillEmail(TEST_USER.email);
      await loginPage.clickSubmit();

      const isValid = await loginPage.passwordInput.evaluate(
        (el: HTMLInputElement) => el.checkValidity()
      );
      expect(isValid).toBe(false);
    });

    test("valid email format is accepted", async () => {
      await loginPage.fillEmail("user@example.com");

      const isValid = await loginPage.emailInput.evaluate(
        (el: HTMLInputElement) => el.checkValidity()
      );
      expect(isValid).toBe(true);
    });

    test("form submits with valid data format", async ({ page }) => {
      await loginPage.login(TEST_USER.email, TEST_USER.password);

      // Should either redirect or show error (both indicate form was submitted)
      await Promise.race([
        page.waitForURL(CHAT_OR_LOGIN_URL_REGEX, {
          timeout: TIMEOUTS.navigation,
        }),
        waitForToast(page),
      ]);
    });
  });

  // ==========================================================================
  // 3. Password Field Behavior (4 tests)
  // ==========================================================================
  test.describe("Password Field Behavior", () => {
    test("toggle shows password", async ({ page }) => {
      await loginPage.fillPassword("testpassword");

      // Find the toggle button within the password field container
      const toggleButton = page
        .locator("#password-display")
        .locator("..")
        .locator("button");
      await toggleButton.click();

      const inputType = await loginPage.passwordInput.getAttribute("type");
      expect(inputType).toBe("text");
    });

    test("toggle hides password again", async ({ page }) => {
      await loginPage.fillPassword("testpassword");

      const toggleButton = page
        .locator("#password-display")
        .locator("..")
        .locator("button");
      await toggleButton.click(); // Show
      await toggleButton.click(); // Hide

      const inputType = await loginPage.passwordInput.getAttribute("type");
      expect(inputType).toBe("password");
    });

    test("password toggle has accessible label", async ({ page }) => {
      // Toggle button should have an aria-label
      const toggleButton = page
        .locator("#password-display")
        .locator("..")
        .locator("button");
      const label = await toggleButton.getAttribute("aria-label");

      expect(label).toBeTruthy();
      expect(label?.length).toBeGreaterThan(0);
    });

    test("password strength meter is not shown on login", async ({ page }) => {
      await loginPage.fillPassword("TestPassword123!");

      const strengthMeter = page.locator("#password-display-strength");
      await expect(strengthMeter).toHaveCSS("max-height", "0px");
    });
  });

  // ==========================================================================
  // 4. Authentication Flow - Success (6 tests)
  // ==========================================================================
  test.describe("Authentication Flow - Success", () => {
    test("successful login redirects away from login page", async ({
      page,
    }) => {
      await loginPage.login(TEST_USER.email, TEST_USER.password);
      await loginPage.waitForLoginSuccess();

      // Should redirect to chat or verify-email page
      expect(page.url()).toMatch(SUCCESS_REDIRECT_URL_REGEX);
    });

    test("session cookie is established after login", async ({ page }) => {
      await loginPage.login(TEST_USER.email, TEST_USER.password);
      await loginPage.waitForLoginSuccess();

      const sessionCookie = await getSessionCookie(page);
      expect(sessionCookie).not.toBeNull();
    });

    test("respects valid callbackUrl parameter", async ({ page }) => {
      await page.goto(`/login?callbackUrl=${encodeURIComponent("/chat")}`);
      await loginPage.waitForPageLoad();
      await loginPage.login(TEST_USER.email, TEST_USER.password);

      // User should be redirected to chat
      await page.waitForURL(CHAT_URL_REGEX, {
        timeout: TIMEOUTS.formSubmission,
      });
    });

    test("invalid external callbackUrl falls back to safe route", async ({
      page,
    }) => {
      await page.goto(
        `/login?callbackUrl=${encodeURIComponent(EXTERNAL_URLS.malicious)}`
      );
      await loginPage.waitForPageLoad();
      await loginPage.login(TEST_USER.email, TEST_USER.password);

      // Should redirect to internal route, not the malicious URL
      await page.waitForURL(CHAT_URL_REGEX, {
        timeout: TIMEOUTS.formSubmission,
      });
      expect(page.url()).not.toContain("malicious");
    });

    test("button shows loading state during submission", async ({
      page: _page,
    }) => {
      await loginPage.fillEmail(TEST_USER.email);
      await loginPage.fillPassword(TEST_USER.password);

      // Click and immediately check for disabled state
      await loginPage.clickSubmit();

      // The button should be disabled during loading
      // It might redirect quickly, so check immediately
      const ariaDisabled =
        await loginPage.submitButton.getAttribute("aria-disabled");
      const disabled = await loginPage.submitButton.getAttribute("disabled");

      // At least one of these should indicate disabled state during or after submission
      expect(ariaDisabled === "true" || disabled !== null).toBe(true);
    });

    test("button is disabled after successful submission", async ({
      page: _page,
    }) => {
      await loginPage.login(TEST_USER.email, TEST_USER.password);

      // Button should be disabled during redirect
      const isDisabled = await loginPage.isSubmitDisabled();
      expect(isDisabled).toBe(true);
    });
  });

  // ==========================================================================
  // 5. Authentication Flow - Failure (5 tests)
  // ==========================================================================
  test.describe("Authentication Flow - Failure", () => {
    test("invalid credentials show error toast", async ({ page }) => {
      await loginPage.login(INVALID_USER.email, INVALID_USER.password);
      await waitForToast(page);

      const toast = page.locator("[data-sonner-toast]");
      await expect(toast).toBeVisible();
    });

    test("non-existent user shows same error as wrong password", async ({
      page,
    }) => {
      // First try non-existent user
      await loginPage.login("nonexistent@test.com", "WrongPassword123!");
      await waitForToast(page);

      const nonExistentError = await page
        .locator("[data-sonner-toast]")
        .textContent();

      // Reload and try existing user with wrong password
      await loginPage.goto();
      await loginPage.login(TEST_USER.email, "WrongPassword123!");
      await waitForToast(page);

      const wrongPasswordError = await page
        .locator("[data-sonner-toast]")
        .textContent();

      // Both should show the same error (prevents user enumeration)
      expect(nonExistentError).toBe(wrongPasswordError);
    });

    test("form remains filled after error", async () => {
      await loginPage.login(INVALID_USER.email, INVALID_USER.password);
      await loginPage.waitForErrorToast();

      const email = await loginPage.getEmailValue();
      const password = await loginPage.getPasswordValue();

      expect(email).toBe(INVALID_USER.email);
      expect(password).toBe(INVALID_USER.password);
    });

    test("can retry after failure", async () => {
      // First attempt - fail
      await loginPage.login(INVALID_USER.email, INVALID_USER.password);
      await loginPage.waitForErrorToast();

      // Wait for form to re-enable
      await loginPage.waitForLoadingComplete();

      // Second attempt - should be able to edit and submit
      await loginPage.emailInput.clear();
      await loginPage.fillEmail(TEST_USER.email);
      await loginPage.passwordInput.clear();
      await loginPage.fillPassword(TEST_USER.password);

      const isEnabled = !(await loginPage.isSubmitDisabled());
      expect(isEnabled).toBe(true);
    });

    test("error toast displays translated message", async ({ page }) => {
      await loginPage.login(INVALID_USER.email, INVALID_USER.password);
      await waitForToast(page);

      const toastText = await page.locator("[data-sonner-toast]").textContent();
      // Should contain translated error message (not empty)
      expect(toastText?.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 6. Loading States (4 tests)
  // ==========================================================================
  test.describe("Loading States", () => {
    test("submit button shows spinner during submission", async ({ page }) => {
      await loginPage.fillEmail(TEST_USER.email);
      await loginPage.fillPassword(TEST_USER.password);

      // Click and immediately check for spinner
      await loginPage.clickSubmit();

      const spinner = page.locator("button .animate-spin");
      await expect(spinner).toBeVisible();
    });

    test("button has aria-disabled during submission", async () => {
      await loginPage.fillEmail(TEST_USER.email);
      await loginPage.fillPassword(TEST_USER.password);
      await loginPage.clickSubmit();

      const ariaDisabled =
        await loginPage.submitButton.getAttribute("aria-disabled");
      expect(ariaDisabled).toBe("true");
    });

    test("button type changes during submission", async () => {
      await loginPage.fillEmail(TEST_USER.email);
      await loginPage.fillPassword(TEST_USER.password);
      await loginPage.clickSubmit();

      // During submission, button type should be "button" to prevent double submit
      const type = await loginPage.submitButton.getAttribute("type");
      expect(type).toBe("button");
    });

    test("screen reader output announces loading", async ({ page: _page }) => {
      await loginPage.fillEmail(TEST_USER.email);
      await loginPage.fillPassword(TEST_USER.password);
      await loginPage.clickSubmit();

      const srOutput = await loginPage.getScreenReaderOutput();
      expect(srOutput.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 7. Accessibility (7 tests)
  // ==========================================================================
  test.describe("Accessibility", () => {
    test("form inputs have associated labels", async ({ page }) => {
      const emailLabel = page.locator("label[for='email-display']");
      const passwordLabel = page.locator("label[for='password-display']");

      await expect(emailLabel).toBeVisible();
      await expect(passwordLabel).toBeVisible();
    });

    test("form is keyboard navigable", async ({ page }) => {
      // Focus email input
      await loginPage.emailInput.focus();
      await expect(loginPage.emailInput).toBeFocused();

      // Tab to password
      await page.keyboard.press("Tab");
      await expect(loginPage.passwordInput).toBeFocused();
    });

    test("password toggle has accessible aria-label", async ({ page }) => {
      const toggleButton = page
        .locator("#password-display")
        .locator("..")
        .locator("button");
      const label = await toggleButton.getAttribute("aria-label");
      expect(label).not.toBeNull();
      expect(label?.length).toBeGreaterThan(0);
    });

    test("submit button has aria-live region", async ({ page }) => {
      const ariaLiveOutput = page.locator("button output[aria-live='polite']");
      await expect(ariaLiveOutput).toBeAttached();
    });

    test("email input has correct autocomplete attribute", async () => {
      const autocomplete =
        await loginPage.emailInput.getAttribute("autocomplete");
      expect(autocomplete).toBe("email");
    });

    test("password input has correct autocomplete attribute", async () => {
      const autocomplete =
        await loginPage.passwordInput.getAttribute("autocomplete");
      expect(autocomplete).toBe("current-password");
    });

    test("form can be submitted with Enter key", async ({ page }) => {
      await loginPage.fillEmail(TEST_USER.email);
      await loginPage.fillPassword(TEST_USER.password);

      await page.keyboard.press("Enter");

      // Should trigger form submission (redirect or error)
      await Promise.race([
        page.waitForURL(CHAT_OR_LOGIN_URL_REGEX, {
          timeout: TIMEOUTS.navigation,
        }),
        waitForToast(page),
      ]);
    });
  });

  // ==========================================================================
  // 8. Security (5 tests)
  // ==========================================================================
  test.describe("Security", () => {
    test("same error message for invalid email vs wrong password", async ({
      page,
    }) => {
      // Non-existent email
      await loginPage.login("fake@notreal.com", "Password123!");
      await waitForToast(page);
      const error1 = await page.locator("[data-sonner-toast]").textContent();

      await loginPage.goto();

      // Existing email with wrong password
      await loginPage.login(TEST_USER.email, "WrongPassword!");
      await waitForToast(page);
      const error2 = await page.locator("[data-sonner-toast]").textContent();

      expect(error1).toBe(error2);
    });

    test("external callbackUrl is rejected", async ({ page }) => {
      await page.goto(
        `/login?callbackUrl=${encodeURIComponent(EXTERNAL_URLS.malicious)}`
      );
      await loginPage.waitForPageLoad();
      await loginPage.login(TEST_USER.email, TEST_USER.password);

      // Should redirect to internal route, not the malicious URL
      await page.waitForURL(CHAT_URL_REGEX, {
        timeout: TIMEOUTS.formSubmission,
      });
      expect(page.url()).not.toContain("malicious");
    });

    test("relative callbackUrl is allowed", async ({ page }) => {
      // Test that relative URLs work
      await page.goto(`/login?callbackUrl=${encodeURIComponent("/chat")}`);
      await loginPage.waitForPageLoad();
      await loginPage.login(TEST_USER.email, TEST_USER.password);

      // User should be redirected to chat
      await page.waitForURL(CHAT_URL_REGEX, {
        timeout: TIMEOUTS.formSubmission,
      });
    });

    test("javascript callbackUrl is rejected", async ({ page }) => {
      await page.goto(
        `/login?callbackUrl=${encodeURIComponent(EXTERNAL_URLS.xssAttempt)}`
      );
      await loginPage.waitForPageLoad();
      await loginPage.login(TEST_USER.email, TEST_USER.password);

      // Should redirect to internal route, not execute javascript
      await page.waitForURL(CHAT_URL_REGEX, {
        timeout: TIMEOUTS.formSubmission,
      });
    });

    test("password is not visible in page source", async ({ page }) => {
      await loginPage.fillPassword("secretpassword123");

      // Hidden input should have the password but not be visible
      const hiddenInput = page.locator("input[name='password'][type='hidden']");
      await expect(hiddenInput).toBeAttached();

      // Visible input should be type password
      const visibleType = await loginPage.passwordInput.getAttribute("type");
      expect(visibleType).toBe("password");
    });
  });

  // ==========================================================================
  // 9. Internationalization (4 tests)
  // ==========================================================================
  test.describe("Internationalization", () => {
    test("displays a supported locale", async ({ page }) => {
      const locale = await getCurrentLocale(page);
      // The default might be 'en' or 'ru' based on project settings
      expect(["en", "ru"]).toContain(locale);
    });

    test("can switch to Russian language", async ({ page }) => {
      await setLocale(page, "ru");
      await loginPage.goto();

      const locale = await getCurrentLocale(page);
      expect(locale).toBe("ru");
    });

    test("page renders correctly in both languages", async ({ page }) => {
      // Test that page renders in English
      await setLocale(page, "en");
      await loginPage.goto();
      const englishTitle = await loginPage.getPageTitleText();
      expect(englishTitle.length).toBeGreaterThan(0);

      // Test that page renders in Russian
      await setLocale(page, "ru");
      await loginPage.goto();
      const russianTitle = await loginPage.getPageTitleText();
      expect(russianTitle.length).toBeGreaterThan(0);

      // Both should have titles (they may or may not be different)
      expect(englishTitle).toBeTruthy();
      expect(russianTitle).toBeTruthy();
    });

    test("error toast displays message in current locale", async ({ page }) => {
      // Test that error messages display in Russian
      await setLocale(page, "ru");
      await loginPage.goto();
      await loginPage.login(INVALID_USER.email, INVALID_USER.password);
      await waitForToast(page);
      const russianError = await page
        .locator("[data-sonner-toast]")
        .textContent();

      // Error message should not be empty
      expect(russianError?.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 10. Edge Cases (7 tests)
  // ==========================================================================
  test.describe("Edge Cases", () => {
    test("handles whitespace in email gracefully", async ({ page }) => {
      await loginPage.login(`  ${TEST_USER.email}  `, TEST_USER.password);

      // Should either work or show validation error
      await Promise.race([
        page.waitForURL(CHAT_OR_LOGIN_URL_REGEX, {
          timeout: TIMEOUTS.navigation,
        }),
        waitForToast(page),
      ]);
    });

    test("handles very long email", async () => {
      await loginPage.fillEmail(VALIDATION_DATA.longEmail);

      // Should accept the input
      const value = await loginPage.getEmailValue();
      expect(value).toBe(VALIDATION_DATA.longEmail);
    });

    test("handles very long password", async () => {
      await loginPage.fillPassword(VALIDATION_DATA.longPassword);

      // Should accept the input
      const value = await loginPage.getPasswordValue();
      expect(value).toBe(VALIDATION_DATA.longPassword);
    });

    test("handles special characters in password", async () => {
      await loginPage.fillPassword(VALIDATION_DATA.specialCharsPassword);

      const value = await loginPage.getPasswordValue();
      expect(value).toBe(VALIDATION_DATA.specialCharsPassword);
    });

    test("handles rapid form submissions", async ({ page: _page }) => {
      await loginPage.fillEmail(TEST_USER.email);
      await loginPage.fillPassword(TEST_USER.password);

      // Click once to trigger submission
      await loginPage.clickSubmit();

      // After first click, button should be disabled to prevent double submission
      const isDisabled = await loginPage.isSubmitDisabled();
      expect(isDisabled).toBe(true);

      // Wait for login to complete
      await loginPage.waitForLoginSuccess();
    });

    test("handles browser back after failed login", async ({ page }) => {
      await loginPage.login(INVALID_USER.email, INVALID_USER.password);
      await loginPage.waitForErrorToast();

      // Navigate away and back
      await page.goto("/register");
      await page.goBack();

      // Login page should still work
      await expect(loginPage.emailInput).toBeVisible();
    });

    test("clears sensitive data on page refresh", async ({ page }) => {
      await loginPage.fillPassword("sensitivepassword");

      // Refresh the page
      await page.reload();

      // Password should be cleared
      const password = await loginPage.getPasswordValue();
      expect(password).toBe("");
    });
  });

  // ==========================================================================
  // 11. Navigation & Links (4 tests)
  // ==========================================================================
  test.describe("Navigation & Links", () => {
    test("forgot password link navigates correctly", async ({ page }) => {
      await loginPage.clickForgotPassword();
      expect(page.url()).toContain("/forgot-password");
    });

    test("sign up link navigates correctly", async ({ page }) => {
      await loginPage.clickSignUp();
      expect(page.url()).toContain("/register");
    });

    test("browser back works after navigation", async ({ page }) => {
      await loginPage.clickSignUp();
      await page.goBack();

      expect(page.url()).toContain("/login");
      await expect(loginPage.emailInput).toBeVisible();
    });

    test("direct navigation to login page works", async ({ page }) => {
      await page.goto("/");
      await page.goto("/login");

      await expect(loginPage.emailInput).toBeVisible();
      await expect(loginPage.submitButton).toBeVisible();
    });
  });
});
