import { ChatSDKError } from "../../../errors";
import { db } from "../../connection";
import {
  type IntegrationConnection,
  integrationConnection,
} from "../../schema";
import { isUniqueViolation } from "../../unique-violation";

export type NewIntegrationConnection = Omit<
  typeof integrationConnection.$inferInsert,
  "id" | "createdAt" | "updatedAt" | "lastUsedAt"
>;

export async function insertIntegration(
  values: NewIntegrationConnection
): Promise<IntegrationConnection> {
  try {
    const [created] = await db
      .insert(integrationConnection)
      .values(values)
      .returning();
    return created;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ChatSDKError(
        "bad_request:database",
        "Integration already connected"
      );
    }
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create integration"
    );
  }
}
