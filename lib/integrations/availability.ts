import { isIntegrationsEnabled } from "@/lib/flags";
import { isFreeUserById } from "@/lib/subscription/is-free-user";

/** Whether the composer should offer integrations to this user at all. */
export async function isIntegrationsAvailableForUser(
  userId: string
): Promise<boolean> {
  if (!(await isIntegrationsEnabled())) {
    return false;
  }
  return !(await isFreeUserById(userId));
}
