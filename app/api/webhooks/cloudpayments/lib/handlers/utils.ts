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

export function toNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isNaN(value) ? null : value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}
