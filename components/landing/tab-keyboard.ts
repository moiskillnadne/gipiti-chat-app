/**
 * The tab a key press moves to in an ARIA tablist (APG tabs pattern): Left/Right step and wrap,
 * Home/End jump to the ends. Returns null for any other key, so the caller leaves it alone.
 */
export const getTabIndexForKey = (
  key: string,
  currentIndex: number,
  tabCount: number
): number | null => {
  if (tabCount <= 0) {
    return null;
  }

  switch (key) {
    case "ArrowRight":
      return (currentIndex + 1) % tabCount;
    case "ArrowLeft":
      return (currentIndex - 1 + tabCount) % tabCount;
    case "Home":
      return 0;
    case "End":
      return tabCount - 1;
    default:
      return null;
  }
};
