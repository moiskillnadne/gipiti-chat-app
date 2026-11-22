/**
 * Canonical form of an email address for storage and lookup.
 *
 * RFC 5321 makes the local part case-sensitive, but no mail provider we target
 * actually treats it that way, and users routinely retype their address with
 * different capitalisation. Without folding case, `User@mail.ru` and
 * `user@mail.ru` register as two separate accounts — each collecting its own
 * welcome grant — and the second one silently shadows the first at login.
 *
 * Deliberately does NOT strip plus-tags (`me+shop@gmail.com`) or dots
 * (`m.e@gmail.com`). Those are provider-specific aliasing rules, and collapsing
 * them would reject addresses that real users treat as their primary one. They
 * are a separate anti-abuse decision, not a correctness fix.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
