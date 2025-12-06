export function parseWebhookData<T extends object>(rawData?: string): T | null {
  if (!rawData) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawData);
    if (parsed && typeof parsed === "object") {
      return parsed as T;
    }
  } catch {
    return null;
  }

  return null;
}
