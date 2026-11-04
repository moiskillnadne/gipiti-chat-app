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

/** Thrown when the user already has this builtin or custom server connected. */
export class IntegrationAlreadyConnectedError extends Error {
  constructor() {
    super("Integration already connected");
    this.name = "IntegrationAlreadyConnectedError";
  }
}

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
      throw new IntegrationAlreadyConnectedError();
    }
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create integration"
    );
  }
}
