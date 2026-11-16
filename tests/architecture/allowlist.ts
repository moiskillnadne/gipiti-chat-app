import type { RuleId } from "./rules";

export type AllowedViolation = {
  rule: RuleId;
  from: string;
  to: string;
  reason: string;
};

/**
 * Boundary violations that exist today and are tolerated until they are
 * fixed. The list may only shrink: `boundaries.test.ts` fails when an entry
 * no longer matches a real violation, so a fix removes its entry in the same
 * change. Do not add an entry to make a new violation pass; fix the import.
 */
export const ALLOWED_VIOLATIONS: AllowedViolation[] = [
  {
    rule: "lib-imports-app",
    from: "lib/ai/entitlements.ts",
    to: "app/(auth)/auth",
    reason:
      "Type-only import of UserType. Goes away when the auth module moves to server/modules/auth (roadmap Phase 4a).",
  },
];
