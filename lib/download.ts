/**
 * Download an asset by URL through the browser. Fetches the resource, creates
 * a temporary object URL, and triggers a click on a hidden anchor — the only
 * portable way to force the browser to save (rather than navigate to) the file.
 *
 * The saved name is `preferredFilename` when given (e.g. a user attachment's
 * original name), else the URL's last segment, else `fallbackFilename`.
 */
export const downloadFromUrl = async (
  url: string,
  fallbackFilename: string,
  preferredFilename?: string
): Promise<void> => {
  const response = await fetch(url);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = preferredFilename ?? url.split("/").pop() ?? fallbackFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
};
