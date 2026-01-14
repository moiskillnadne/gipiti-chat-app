import type { Page } from "@playwright/test"
import { TIMEOUTS } from "./fixtures"

/**
 * Wait for a toast notification to appear
 */
export async function waitForToast(page: Page, text?: string): Promise<void> {
  const toastSelector = "[data-sonner-toast]"

  if (text) {
    await page.locator(toastSelector).filter({ hasText: text }).waitFor({
      state: "visible",
      timeout: TIMEOUTS.toast,
    })
  } else {
    await page.locator(toastSelector).first().waitFor({
      state: "visible",
      timeout: TIMEOUTS.toast,
    })
  }
}

/**
 * Wait for toast to disappear
 */
export async function waitForToastToDisappear(page: Page): Promise<void> {
  await page.locator("[data-sonner-toast]").waitFor({
    state: "hidden",
    timeout: TIMEOUTS.toast,
  })
}

/**
 * Get all visible toast messages
 */
export async function getToastMessages(page: Page): Promise<string[]> {
  const toasts = page.locator("[data-sonner-toast]")
  const count = await toasts.count()
  const messages: string[] = []

  for (let i = 0; i < count; i++) {
    const text = await toasts.nth(i).textContent()
    if (text) messages.push(text)
  }

  return messages
}

/**
 * Dismiss all visible toasts by clicking their close buttons
 */
export async function dismissAllToasts(page: Page): Promise<void> {
  const closeButtons = page.locator("[data-sonner-toast] button[aria-label='Close']")
  const count = await closeButtons.count()

  for (let i = 0; i < count; i++) {
    await closeButtons.nth(i).click()
  }
}

/**
 * Wait for navigation to complete
 */
export async function waitForNavigation(
  page: Page,
  urlPattern: string | RegExp
): Promise<void> {
  await page.waitForURL(urlPattern, { timeout: TIMEOUTS.navigation })
}

/**
 * Check if an element has a specific attribute value
 */
export async function hasAttribute(
  page: Page,
  selector: string,
  attribute: string,
  value: string
): Promise<boolean> {
  const element = page.locator(selector)
  const attrValue = await element.getAttribute(attribute)
  return attrValue === value
}

/**
 * Get the current locale from cookie
 */
export async function getCurrentLocale(page: Page): Promise<string> {
  const cookies = await page.context().cookies()
  const localeCookie = cookies.find((c) => c.name === "NEXT_LOCALE")
  return localeCookie?.value ?? "en"
}

/**
 * Set the locale via cookie
 */
export async function setLocale(page: Page, locale: string): Promise<void> {
  await page.context().addCookies([
    {
      name: "NEXT_LOCALE",
      value: locale,
      domain: "localhost",
      path: "/",
    },
  ])
}

/**
 * Clear all cookies and local storage
 */
export async function clearBrowserState(page: Page): Promise<void> {
  await page.context().clearCookies()
  await page.evaluate(() => localStorage.clear())
}

/**
 * Get session cookies (for checking if user is logged in)
 */
export async function getSessionCookie(page: Page): Promise<string | null> {
  const cookies = await page.context().cookies()
  const sessionCookie = cookies.find(
    (c) => c.name.includes("authjs.session-token") || c.name.includes("next-auth.session-token")
  )
  return sessionCookie?.value ?? null
}

/**
 * Wait for button to be enabled
 */
export async function waitForButtonEnabled(
  page: Page,
  selector: string
): Promise<void> {
  await page.locator(selector).waitFor({ state: "visible" })
  await page.waitForFunction(
    (sel) => {
      const button = document.querySelector(sel)
      return button && !button.hasAttribute("disabled")
    },
    selector,
    { timeout: TIMEOUTS.formSubmission }
  )
}

/**
 * Check if form is in loading state (button disabled with spinner)
 */
export async function isFormLoading(page: Page): Promise<boolean> {
  const submitButton = page.locator("button[type='submit'], button[type='button']").first()
  const isDisabled = await submitButton.getAttribute("aria-disabled")
  return isDisabled === "true"
}
