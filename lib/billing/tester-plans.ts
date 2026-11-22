import { getUserById } from "@/server/modules/users/queries/get-by-id";

/**
 * Subscription codes that only internal testers (`User.isTester`) may buy.
 *
 * Server-side source of truth until the `Subscription` table carries its own
 * tester flag. Must equal the seed tiers flagged `isTester` in
 * `lib/subscription/subscription-tiers.ts` (guarded by a unit test).
 */
export const TESTER_ONLY_SUBSCRIPTION_CODES: ReadonlySet<string> = new Set([
  "tester_paid",
]);

export const isTesterOnlySubscriptionCode = (code: string): boolean =>
  TESTER_ONLY_SUBSCRIPTION_CODES.has(code);

type PurchaseEligibilityInput = {
  code: string;
  /** Must come from the `User` row, never from the session JWT. */
  isTester: boolean;
};

/**
 * Whether a user with the given tester status may buy the plan `code`.
 */
export const isSubscriptionPurchaseAllowed = ({
  code,
  isTester,
}: PurchaseEligibilityInput): boolean =>
  isTester || !isTesterOnlySubscriptionCode(code);

type CanPurchaseSubscriptionInput = {
  userId: string;
  code: string;
};

/**
 * Whether the user may buy the plan `code`, reading `isTester` from the
 * database. A missing user is treated as a non-tester.
 */
export async function canPurchaseSubscription({
  userId,
  code,
}: CanPurchaseSubscriptionInput): Promise<boolean> {
  if (!isTesterOnlySubscriptionCode(code)) {
    return true;
  }

  const userRecord = await getUserById(userId);

  return isSubscriptionPurchaseAllowed({
    code,
    isTester: userRecord?.isTester ?? false,
  });
}
