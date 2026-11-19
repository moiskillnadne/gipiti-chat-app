import { and, eq, gt } from "drizzle-orm";
import { db } from "@/server/db/connection";
import { type User, user } from "@/server/db/schema";
import { ChatSDKError } from "../../../errors";

export async function getUserByResetToken({
  hashedToken,
}: {
  hashedToken: string;
}): Promise<User | null> {
  try {
    const [foundUser] = await db
      .select()
      .from(user)
      .where(
        and(
          eq(user.resetPasswordToken, hashedToken),
          gt(user.resetPasswordTokenExpiry, new Date())
        )
      );

    return foundUser || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get user by reset token"
    );
  }
}
