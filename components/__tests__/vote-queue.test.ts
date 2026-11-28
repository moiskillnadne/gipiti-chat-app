import { describe, expect, it } from "vitest";

import {
  settleVoteRequest,
  startVoteRequest,
  type VoteRecord,
} from "../vote-queue";

type Click = { isUpvoted: boolean; didSucceed: boolean };

/**
 * Plays clicks the way the hook does: every click writes its vote to the cache
 * at once, then the requests settle in click order.
 */
const play = (
  clicks: Click[],
  initialVote: boolean | undefined
): { cache: boolean | undefined; confirmed: boolean | undefined } => {
  let cache = initialVote;
  let record: VoteRecord | undefined;
  for (const click of clicks) {
    record = startVoteRequest(record, cache);
    cache = click.isUpvoted;
  }
  for (const click of clicks) {
    if (!record) {
      break;
    }
    const settlement = settleVoteRequest(record, click);
    record = settlement.record;
    if (settlement.cacheWrite) {
      cache = settlement.cacheWrite.isUpvoted;
    }
  }

  return { cache, confirmed: record?.confirmed };
};

describe("two queued votes on a message with no vote", () => {
  it("fail then fail: shows no vote, as the server holds none", () => {
    // Arrange
    const clicks = [
      { isUpvoted: true, didSucceed: false },
      { isUpvoted: false, didSucceed: false },
    ];

    // Act
    const result = play(clicks, undefined);

    // Assert
    expect(result.cache).toBeUndefined();
  });

  it("ok then fail: goes back to the first vote, which the server holds", () => {
    // Arrange
    const clicks = [
      { isUpvoted: true, didSucceed: true },
      { isUpvoted: false, didSucceed: false },
    ];

    // Act
    const result = play(clicks, undefined);

    // Assert
    expect(result.cache).toBe(true);
  });

  it("fail then ok: shows the second vote", () => {
    // Arrange
    const clicks = [
      { isUpvoted: true, didSucceed: false },
      { isUpvoted: false, didSucceed: true },
    ];

    // Act
    const result = play(clicks, undefined);

    // Assert
    expect(result.cache).toBe(false);
  });

  it("ok then ok: shows the second vote", () => {
    // Arrange
    const clicks = [
      { isUpvoted: true, didSucceed: true },
      { isUpvoted: false, didSucceed: true },
    ];

    // Act
    const result = play(clicks, undefined);

    // Assert
    expect(result.cache).toBe(false);
  });
});

describe("settleVoteRequest", () => {
  it("does not write to the cache while a later request is queued", () => {
    // Arrange
    const record = startVoteRequest(
      startVoteRequest(undefined, undefined),
      true
    );

    // Act
    const first = settleVoteRequest(record, {
      isUpvoted: true,
      didSucceed: true,
    });
    const afterFirst = first;

    // Assert
    expect(afterFirst.cacheWrite).toBeNull();
    expect(afterFirst.record).toEqual({ confirmed: true, queued: 1 });
  });

  it("three alternating votes that all fail leave the vote from before the first click", () => {
    // Arrange
    const clicks = [
      { isUpvoted: true, didSucceed: false },
      { isUpvoted: false, didSucceed: false },
      { isUpvoted: true, didSucceed: false },
    ];

    // Act
    const fromNothing = play(clicks, undefined);
    const fromDownvote = play(clicks, false);

    // Assert
    expect(fromNothing.cache).toBeUndefined();
    expect(fromDownvote.cache).toBe(false);
  });

  it("starts from the cached vote again once nothing is queued", () => {
    // Arrange
    const idle: VoteRecord = { confirmed: true, queued: 0 };

    // Act
    const record = startVoteRequest(idle, false);

    // Assert
    expect(record).toEqual({ confirmed: false, queued: 1 });
  });
});
