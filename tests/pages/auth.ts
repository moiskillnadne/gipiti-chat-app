import type { Locator, Page } from "@playwright/test"
import { expect } from "@playwright/test"
import { TEST_URLS, TIMEOUTS } from "../fixtures"
import { waitForToast } from "../helpers"

/**
 * Page Object Model for the Login Page (/login)
 */
export class LoginPage {
  readonly page: Page

  // Form elements
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly submitButton: Locator
  readonly passwordToggle: Locator

  // Links
  readonly forgotPasswordLink: Locator
  readonly signUpLink: Locator

  // Page elements
  readonly pageTitle: Locator
  readonly pageSubtitle: Locator
  readonly languageSwitcher: Locator
  readonly supportLink: Locator

  // Toast notifications
  readonly errorToast: Locator
  readonly successToast: Locator

  // Loading indicator
  readonly loadingSpinner: Locator

  constructor(page: Page) {
    this.page = page

    // Form elements
    this.emailInput = page.locator("#email-display")
    this.passwordInput = page.locator("#password-display")
    // Submit button - find by role to get the main form button
    this.submitButton = page.getByRole("button", { name: /sign in|войти|submit/i })
    // Password toggle - match aria-label in English or Russian
    this.passwordToggle = page.locator("button[aria-label]").filter({
      has: page.locator("svg"),
    }).first()

    // Links
    this.forgotPasswordLink = page.locator("a[href='/forgot-password']")
    this.signUpLink = page.locator("a[href='/register']")

    // Page elements
    this.pageTitle = page.locator("h3")
    this.pageSubtitle = page.locator("p").first()
    this.languageSwitcher = page.locator("[data-language-switcher]")
    this.supportLink = page.locator("a[href*='support'], a[href*='help']")

    // Toast notifications (Sonner)
    this.errorToast = page.locator("[data-sonner-toast][data-type='error']")
    this.successToast = page.locator("[data-sonner-toast][data-type='success']")

    // Loading indicator
    this.loadingSpinner = page.locator("button .animate-spin")
  }

  /**
   * Navigate to the login page
   */
  async goto(callbackUrl?: string): Promise<void> {
    const url = callbackUrl
      ? `${TEST_URLS.login}?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : TEST_URLS.login

    await this.page.goto(url)
    await this.waitForPageLoad()
  }

  /**
   * Wait for the page to fully load
   */
  async waitForPageLoad(): Promise<void> {
    await this.emailInput.waitFor({ state: "visible", timeout: TIMEOUTS.navigation })
  }

  /**
   * Fill in the email field
   */
  async fillEmail(email: string): Promise<void> {
    await this.emailInput.fill(email)
  }

  /**
   * Fill in the password field
   */
  async fillPassword(password: string): Promise<void> {
    await this.passwordInput.fill(password)
  }

  /**
   * Click the submit button
   */
  async clickSubmit(): Promise<void> {
    await this.submitButton.click()
  }

  /**
   * Perform a complete login action
   */
  async login(email: string, password: string): Promise<void> {
    await this.fillEmail(email)
    await this.fillPassword(password)
    await this.clickSubmit()
  }

  /**
   * Wait for successful login and redirect
   */
  async waitForLoginSuccess(): Promise<void> {
    await this.page.waitForURL(/\/(chat|settings|verify-email|subscribe)/, {
      timeout: TIMEOUTS.formSubmission,
    })
  }

  /**
   * Wait for error toast to appear
   */
  async waitForErrorToast(): Promise<void> {
    await waitForToast(this.page)
  }

  /**
   * Toggle password visibility
   */
  async togglePasswordVisibility(): Promise<void> {
    await this.passwordToggle.click()
  }

  /**
   * Check if password is visible (type="text")
   */
  async isPasswordVisible(): Promise<boolean> {
    const type = await this.passwordInput.getAttribute("type")
    return type === "text"
  }

  /**
   * Check if form is in loading state
   */
  async isLoading(): Promise<boolean> {
    const isDisabled = await this.submitButton.getAttribute("aria-disabled")
    return isDisabled === "true"
  }

  /**
   * Wait for form to stop loading
   */
  async waitForLoadingComplete(): Promise<void> {
    await expect(this.submitButton).not.toHaveAttribute("aria-disabled", "true", {
      timeout: TIMEOUTS.formSubmission,
    })
  }

  /**
   * Get the current email value
   */
  async getEmailValue(): Promise<string> {
    return await this.emailInput.inputValue()
  }

  /**
   * Get the current password value
   */
  async getPasswordValue(): Promise<string> {
    return await this.passwordInput.inputValue()
  }

  /**
   * Check if email input has autofocus
   */
  async hasEmailAutofocus(): Promise<boolean> {
    return await this.emailInput.evaluate((el) => el === document.activeElement)
  }

  /**
   * Navigate to forgot password page
   */
  async clickForgotPassword(): Promise<void> {
    await this.forgotPasswordLink.click()
    await this.page.waitForURL(`**${TEST_URLS.forgotPassword}**`, {
      timeout: TIMEOUTS.navigation,
    })
  }

  /**
   * Navigate to register page
   */
  async clickSignUp(): Promise<void> {
    await this.signUpLink.click()
    await this.page.waitForURL(`**${TEST_URLS.register}**`, {
      timeout: TIMEOUTS.navigation,
    })
  }

  /**
   * Get the password toggle button's aria-label
   */
  async getPasswordToggleLabel(): Promise<string | null> {
    return await this.passwordToggle.getAttribute("aria-label")
  }

  /**
   * Press Tab to navigate through form elements
   */
  async tabThroughForm(): Promise<string[]> {
    const focusedElements: string[] = []

    // Start from email input
    await this.emailInput.focus()
    focusedElements.push(await this.getFocusedElementId())

    // Tab through elements
    for (let i = 0; i < 5; i++) {
      await this.page.keyboard.press("Tab")
      const id = await this.getFocusedElementId()
      if (id) focusedElements.push(id)
    }

    return focusedElements
  }

  /**
   * Get the ID or role of the currently focused element
   */
  private async getFocusedElementId(): Promise<string> {
    return await this.page.evaluate(() => {
      const el = document.activeElement
      return el?.id || el?.getAttribute("role") || el?.tagName.toLowerCase() || "unknown"
    })
  }

  /**
   * Get page title text
   */
  async getPageTitleText(): Promise<string> {
    return (await this.pageTitle.textContent()) ?? ""
  }

  /**
   * Get error toast message
   */
  async getErrorToastMessage(): Promise<string> {
    await this.errorToast.waitFor({ state: "visible", timeout: TIMEOUTS.toast })
    return (await this.errorToast.textContent()) ?? ""
  }

  /**
   * Dismiss error toast if visible
   */
  async dismissErrorToast(): Promise<void> {
    const closeButton = this.errorToast.locator("button[aria-label='Close']")
    if (await closeButton.isVisible()) {
      await closeButton.click()
    }
  }

  /**
   * Check if submit button is disabled
   */
  async isSubmitDisabled(): Promise<boolean> {
    const disabled = await this.submitButton.getAttribute("disabled")
    const ariaDisabled = await this.submitButton.getAttribute("aria-disabled")
    return disabled !== null || ariaDisabled === "true"
  }

  /**
   * Get the screen reader output text
   */
  async getScreenReaderOutput(): Promise<string> {
    const output = this.page.locator("output.sr-only")
    return (await output.textContent()) ?? ""
  }
}
