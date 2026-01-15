/**
 * Test fixtures and constants for Playwright E2E tests
 */

/** Test user with valid credentials (created in global-setup) */
export const TEST_USER = {
  email: "test@example.com",
  password: "TestPassword123!",
};

/** Invalid user for testing failed authentication */
export const INVALID_USER = {
  email: "nonexistent@example.com",
  password: "WrongPassword123!",
};

/** Test data for validation scenarios */
export const VALIDATION_DATA = {
  invalidEmails: [
    "not-an-email",
    "missing@domain",
    "@nodomain.com",
    "spaces in@email.com",
    "",
  ],
  validEmails: [
    "user@example.com",
    "test.user@domain.org",
    "user+tag@example.com",
  ],
  emptyPassword: "",
  longEmail: `${"a".repeat(50)}@example.com`,
  longPassword: `${"A".repeat(100)}a1!`,
  specialCharsPassword: "Test!@#$%^&*()_+-=[]{}|;':\",./<>?123",
  whitespaceEmail: "  test@example.com  ",
};

/** URLs used in tests */
export const TEST_URLS = {
  login: "/login",
  register: "/register",
  chat: "/chat",
  forgotPassword: "/forgot-password",
  settings: "/settings",
};

/** External URLs for security tests */
export const EXTERNAL_URLS = {
  malicious: "https://malicious-site.com",
  xssAttempt: "javascript:alert('xss')",
};

/** Timeouts for various operations */
export const TIMEOUTS = {
  navigation: 10_000,
  toast: 5000,
  formSubmission: 15_000,
};
