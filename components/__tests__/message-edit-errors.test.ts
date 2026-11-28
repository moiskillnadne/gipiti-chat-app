import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";

import { canEditProceedAfterDeleteError } from "../message-edit-errors";

describe("canEditProceedAfterDeleteError", () => {
  it("lets the edit go on when the chat or message is not found", () => {
    // Arrange
    const error = new ORPCError("NOT_FOUND", { status: 404 });

    // Act / Assert
    expect(canEditProceedAfterDeleteError(error)).toBe(true);
  });

  it("stops the edit on a server error", () => {
    // Arrange
    const error = new ORPCError("INTERNAL_SERVER_ERROR", { status: 500 });

    // Act / Assert
    expect(canEditProceedAfterDeleteError(error)).toBe(false);
  });

  it("stops the edit on a network failure", () => {
    // Act / Assert
    expect(canEditProceedAfterDeleteError(new TypeError("offline"))).toBe(
      false
    );
  });
});
