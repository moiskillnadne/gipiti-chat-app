import { eq } from "drizzle-orm";
import { ChatSDKError } from "../../../errors";
import { db } from "../../connection";
import { user } from "../../schema";

export async function isEmailVerified({
  email,
}: {
  email: string;
}): Promise<boolean> {
  try {
    const [foundUser] = await db
      .select({ emailVerified: user.emailVerified })
      .from(user)
      .where(eq(user.email, email));

    return foundUser?.emailVerified ?? false;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to check email verification status"
    );
  }
}
