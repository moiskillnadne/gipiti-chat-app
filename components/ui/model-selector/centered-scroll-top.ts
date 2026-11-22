type CenteredScrollTopInput = {
  /** Row top relative to the top of the list's scrollable content. */
  rowOffsetTop: number;
  rowHeight: number;
  listHeight: number;
  listScrollHeight: number;
};

/**
 * The list `scrollTop` that centres a row in its own scroll container, clamped to the
 * scrollable range. Setting `scrollTop` directly never scrolls the page, unlike
 * `scrollIntoView`.
 */
export const centeredScrollTop = ({
  rowOffsetTop,
  rowHeight,
  listHeight,
  listScrollHeight,
}: CenteredScrollTopInput): number => {
  const maxScrollTop = Math.max(0, listScrollHeight - listHeight);
  const centered = rowOffsetTop - (listHeight - rowHeight) / 2;
  return Math.min(maxScrollTop, Math.max(0, centered));
};
