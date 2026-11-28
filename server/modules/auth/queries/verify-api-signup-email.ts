import { ChatSDKError } from "@/lib/errors";
import { db } from "@/server/db/connection";
import { grantDeferredWelcomeBonus } from "@/server/modules/billing/balance";
import { markEmailAsVerified } from "@/server/modules/users/queries/mark-email-as-verified";

/**
 * Marks the email of an API sign-up verified and credits the welcome grant
 * it has been waiting for, in one transaction.
 *
 * Together, because nothing would pay the grant later: once the email is
 * verified the code cannot be entered again. If the grant fails, the
 * verification is rolled back with it, the code stays valid, and entering it
 * again does both. (A website sign-up is safe in the same way: its grant is
 * written with the account.)
 *
 * @returns whether the grant was credited now; false when the account turned
 * out not to be owed one
 * @throws ChatSDKError when either step fails; nothing is changed then
 */
export async function markVerifiedAndGrantDeferredWelcome({
  email,
  userId,
}: {
  email: string;
  userId: string;
}): Promise<boolean> {
  try {
    return await db.transaction(async (tx) => {
      await markEmailAsVerified({ email }, tx);

      const grant = await grantDeferredWelcomeBonus(userId, tx);

      return grant !== null;
    });
  } catch (error) {
    console.error("[verify-api-signup-email] rolled back:", error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to verify the email of an API sign-up"
    );
  }
}
