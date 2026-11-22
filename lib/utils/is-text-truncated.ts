type MeasurableElement = Pick<HTMLElement, "scrollWidth" | "clientWidth">;

/**
 * True when a single-line, ellipsis-truncated element hides part of its text:
 * its content is wider than the box that clips it.
 */
export const isTextTruncated = (element: MeasurableElement | null): boolean =>
  element !== null && element.scrollWidth > element.clientWidth;
