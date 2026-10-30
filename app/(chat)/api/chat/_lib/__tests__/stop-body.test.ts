import { describe, expect, it } from "vitest";
import { stopBodySchema } from "../stop-body";

const ID = "6f1c1c1e-3b9a-4a61-9f62-1f3a9a5f2f10";
const OTHER = "0b1d6c66-8f3e-4a5e-8c3c-0d4f1f7f9a11";

describe("stopBodySchema", () => {
  it("accepts a turnId", () => {
    expect(stopBodySchema.parse({ turnId: ID })).toEqual({ turnId: ID });
  });

  it("accepts the legacy messageId of cached clients", () => {
    expect(stopBodySchema.parse({ messageId: ID })).toEqual({ turnId: ID });
  });

  it("prefers turnId when both are sent", () => {
    expect(stopBodySchema.parse({ turnId: ID, messageId: OTHER })).toEqual({
      turnId: ID,
    });
  });

  it("rejects an empty body and non-uuid ids", () => {
    expect(stopBodySchema.safeParse({}).success).toBe(false);
    expect(stopBodySchema.safeParse({ turnId: "nope" }).success).toBe(false);
  });
});
