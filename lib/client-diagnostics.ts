/** Longest error stack forwarded to /api/log; keeps beacon payloads small. */
const MAX_STACK_LENGTH = 1500;

/** Google Translate marks the root element with `translated-ltr`/`-rtl`. */
const TRANSLATED_CLASS_PREFIX = "translated-";

/**
 * Browser context attached to client error reports, so a crash can be told
 * apart as a code bug, a DOM-mutating extension, or deployment skew.
 */
export type ClientDiagnostics = {
  userAgent?: string;
  language?: string;
  /** Git commit of the client bundle (Vercel system env), if exposed. */
  buildId?: string;
  /** `lang` of the root element — translators rewrite it. */
  documentLang?: string;
  /** Whether a page translator has rewritten the DOM. */
  isPageTranslated?: boolean;
};

/**
 * Detect a page translator (Chrome/Yandex Translate and similar extensions).
 * They wrap text in `<font>` elements, which the app itself never renders, and
 * Google Translate also tags the root element with a `translated-*` class.
 */
export const detectPageTranslation = (doc: Document): boolean => {
  const hasTranslatedClass = Array.from(doc.documentElement.classList).some(
    (className) => className.startsWith(TRANSLATED_CLASS_PREFIX)
  );
  return hasTranslatedClass || doc.querySelector("font") !== null;
};

/** Collect browser diagnostics; returns an empty object outside the browser. */
export const getClientDiagnostics = (): ClientDiagnostics => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return {};
  }
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    buildId: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    documentLang: document.documentElement.lang,
    isPageTranslated: detectPageTranslation(document),
  };
};

/** Trim an error stack to a size that is safe to send in a log beacon. */
export const truncateStack = (stack: string | undefined): string | undefined =>
  stack?.slice(0, MAX_STACK_LENGTH);
