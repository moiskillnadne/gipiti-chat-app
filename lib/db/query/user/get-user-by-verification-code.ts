import { and, eq, gt } from "drizzle-orm";
import { ChatSDKError } from "../../../errors";
import { db } from "../../queries";
import { type User, user } from "../../schema";

export async function getUserByVerificationCode({
  hashedCode,
}: {
  hashedCode: string;
}): Promise<User | null> {
  try {
    const [foundUser] = await db
      .select()
      .from(user)
      .where(
        and(
          eq(user.emailVerificationCode, hashedCode),
          gt(user.emailVerificationCodeExpiry, new Date())
        )
      );

    return foundUser || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get user by verification code"
    );
  }
}
