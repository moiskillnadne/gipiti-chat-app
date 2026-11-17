import disposableDomains from "./disposable-email-domains.json" with {
  type: "json",
};

/**
 * Domains of throwaway mailbox services.
 *
 * A snapshot of the public, CC0-licensed list at
 * https://github.com/disposable-email-domains/disposable-email-domains
 * (`disposable_email_blocklist.conf`, taken on 2026-11-16), kept in the
 * repository so sign-up needs no network call and no runtime dependency. To
 * stop rejecting a domain that turns out to be a real provider, delete its
 * line from `disposable-email-domains.json`.
 */
const DISPOSABLE_DOMAINS: ReadonlySet<string> = new Set(disposableDomains);

const TRAILING_DOT = /\.$/;

/**
 * True when the address belongs to a throwaway mailbox service: its domain,
 * or a parent of its domain, is on the list (`user@anything.mailinator.com`
 * counts as `mailinator.com`).
 *
 * Sign-up grants free balance per account, so a throwaway address is a free
 * way to collect it again and again.
 */
export const isDisposableEmail = (email: string): boolean => {
  const domain = email
    .slice(email.lastIndexOf("@") + 1)
    .trim()
    .toLowerCase()
    .replace(TRAILING_DOT, "");
  const labels = domain.split(".");

  // Stops before the last label: a bare top-level domain is never on the list.
  return labels
    .slice(0, -1)
    .some((_label, index) =>
      DISPOSABLE_DOMAINS.has(labels.slice(index).join("."))
    );
};
