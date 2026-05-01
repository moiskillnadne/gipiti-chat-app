/**
 * Download an asset by URL through the browser. Fetches the resource, creates
 * a temporary object URL, and triggers a click on a hidden anchor — the only
 * portable way to force the browser to save (rather than navigate to) the file.
 */
export const downloadFromUrl = async (
  url: string,
  fallbackFilename: string
): Promise<void> => {
  const response = await fetch(url);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = url.split("/").pop() ?? fallbackFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
};
