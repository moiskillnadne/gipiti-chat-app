/**
 * Auth pages render their form in the first HTML chunk
 *
 * If a form sits under a `<Suspense>` boundary that suspends on the server,
 * React sends a fallback first and the real form later, inside a hidden
 * staging element that it swaps in up to 300 ms after first paint. When the
 * session request resolves before the swap, React renders a second form on
 * the client while the hidden one is still in the DOM: every id of the form
 * exists twice and the server-rendered form is discarded. That made the login
 * tests fail at random (GIPITI-229); `/login` has its own copy of this check
 * in `login.test.ts`.
 */
import { expect, test } from "@playwright/test";

// How React streams the content of a suspended `<Suspense>` boundary: a
// hidden staging element appended after the first HTML chunk.
const STREAMED_SEGMENT_MARKUP = '<div hidden id="S:';

type AuthPageCase = {
  path: string;
  /** Markup of one input that exists only inside the page's form. */
  formMarkup: string;
};

const AUTH_PAGES: AuthPageCase[] = [
  { path: "/register", formMarkup: 'id="email-display"' },
  { path: "/forgot-password", formMarkup: 'id="email"' },
  {
    path: "/reset-password?token=first-chunk-test-token",
    formMarkup: 'id="confirm-password"',
  },
];

test.describe("Auth pages: the form is in the first HTML chunk", () => {
  for (const { path, formMarkup } of AUTH_PAGES) {
    test(`${path.split("?")[0]} sends its form once, before any streamed segment`, async ({
      request,
    }) => {
      const response = await request.get(path);
      const html = await response.text();
      const servedPath = new URL(response.url()).pathname;

      // `/register` redirects to `/login` while the sign-up flag is off.
      test.skip(
        servedPath !== path.split("?")[0],
        `${path} redirected to ${servedPath} in this environment`
      );

      const formIndex = html.indexOf(formMarkup);

      expect(response.ok()).toBe(true);
      expect(html.split(formMarkup)).toHaveLength(2);
      expect(html.slice(0, formIndex)).not.toContain(STREAMED_SEGMENT_MARKUP);
    });
  }
});
