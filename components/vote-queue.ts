/**
 * What the page knows about the votes of one message that has requests in
 * flight: the vote the server is known to hold, and how many requests are
 * queued (they go one after another, in click order).
 */
export type VoteRecord = {
  /** `undefined`: the server is known to hold no vote on the message. */
  confirmed: boolean | undefined;
  queued: number;
};

/** A change to make to the votes cache; `isUpvoted: undefined` removes the vote. */
export type VoteCacheWrite = { isUpvoted: boolean | undefined };

type SettledRequest = { isUpvoted: boolean; didSucceed: boolean };

type Settlement = { record: VoteRecord; cacheWrite: VoteCacheWrite | null };

/**
 * A click queues a request. When nothing is queued yet, the cached vote (not
 * an earlier click's optimistic value) is what the server holds.
 */
export const startVoteRequest = (
  record: VoteRecord | undefined,
  cachedIsUpvoted: boolean | undefined
): VoteRecord =>
  !record || record.queued === 0
    ? { confirmed: cachedIsUpvoted, queued: 1 }
    : { ...record, queued: record.queued + 1 };

/**
 * A request settled. A success makes its vote the confirmed one. Only the last
 * queued request writes to the cache: a success re-applies its vote, a failure
 * puts the confirmed vote back. An earlier request settles silently, because
 * a later request is going to decide what the cache shows.
 */
export const settleVoteRequest = (
  record: VoteRecord,
  { isUpvoted, didSucceed }: SettledRequest
): Settlement => {
  const confirmed = didSucceed ? isUpvoted : record.confirmed;
  const queued = record.queued - 1;
  const isLast = queued === 0;

  return {
    record: { confirmed, queued },
    cacheWrite: isLast
      ? { isUpvoted: didSucceed ? isUpvoted : confirmed }
      : null,
  };
};
