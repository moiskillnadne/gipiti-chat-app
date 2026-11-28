import { after } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/server/db/connection";
import { recordLegacyHit } from "@/server/http/legacy-hit";

vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/server/db/connection", () => ({ db: { insert: vi.fn() } }));

const HIT_NAME = "GET /api/prompts";

type Upsert = ReturnType<typeof vi.fn>;

/** Make the insert chain end in `onConflictDoUpdate`, which is the given mock. */
const stubInsertChain = (onConflictDoUpdate: Upsert): void => {
  vi.mocked(db.insert).mockReturnValue({
    values: vi.fn().mockReturnValue({ onConflictDoUpdate }),
  } as unknown as ReturnType<typeof db.insert>);
};

/** Wait until the swallowed failure has been logged. */
const flushPromises = (): Promise<void> =>
  new Promise((resolve) => {
    setImmediate(resolve);
  });

describe("recordLegacyHit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // `clearAllMocks` keeps implementations, so set every default here.
    vi.mocked(after).mockReset();
    vi.mocked(db.insert).mockReset();
    vi.spyOn(console, "error").mockReturnValue(undefined);
  });

  it("hands the write to after() and does not start it before after() runs it", () => {
    // Arrange
    const upsert = vi.fn().mockResolvedValue(undefined);
    stubInsertChain(upsert);

    // Act
    recordLegacyHit(HIT_NAME);

    // Assert
    expect(after).toHaveBeenCalledTimes(1);
    const [scheduled] = vi.mocked(after).mock.calls[0];
    expect(scheduled).toEqual(expect.any(Function));
    expect(db.insert).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("writes when the function given to after() is run", async () => {
    // Arrange
    const upsert = vi.fn().mockResolvedValue(undefined);
    stubInsertChain(upsert);
    recordLegacyHit(HIT_NAME);
    const [scheduled] = vi.mocked(after).mock.calls[0];

    // Act
    await (scheduled as () => Promise<void>)();

    // Assert
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("does not throw and logs the name when the increment rejects", async () => {
    // Arrange
    const failure = new Error("connection refused");
    stubInsertChain(vi.fn().mockRejectedValue(failure));

    vi.mocked(after).mockImplementation((task) => {
      (task as () => Promise<void>)();
    });

    // Act
    expect(() => recordLegacyHit(HIT_NAME)).not.toThrow();
    await flushPromises();

    // Assert
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(HIT_NAME),
      failure
    );
  });

  it("still counts the hit when after() throws outside a request scope", async () => {
    // Arrange
    const upsert = vi.fn().mockResolvedValue(undefined);
    stubInsertChain(upsert);
    vi.mocked(after).mockImplementation(() => {
      throw new Error("`after` was called outside a request scope");
    });

    // Act
    expect(() => recordLegacyHit(HIT_NAME)).not.toThrow();
    await flushPromises();

    // Assert
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("swallows a failed increment even when after() throws", async () => {
    // Arrange
    stubInsertChain(vi.fn().mockRejectedValue(new Error("down")));
    vi.mocked(after).mockImplementation(() => {
      throw new Error("no request scope");
    });

    // Act
    expect(() => recordLegacyHit(HIT_NAME)).not.toThrow();
    await flushPromises();

    // Assert
    expect(console.error).toHaveBeenCalledTimes(1);
  });
});
