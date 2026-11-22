import { UTM_MAX_VALUE_LENGTH, type UtmData } from "@/lib/utm/constants";

type RawUtmData = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
};

function normalizeUtmValue(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  // Slice by code point (not UTF-16 unit) to fit varchar(255) without
  // splitting a surrogate pair. UTM values come straight from the query
  // string, so an oversized value must not break the user INSERT.
  return Array.from(value).slice(0, UTM_MAX_VALUE_LENGTH).join("");
}

/**
 * The UTM cookie as the browser wrote it. `components/utm-capture.tsx`
 * stores `encodeURIComponent(JSON)`, and the cookie parser of the framework
 * has usually decoded it once already. A second decode is then a no-op,
 * unless a UTM value holds a literal `%` (`50%off`): that throws, and the
 * value is used as it is.
 */
export function decodeUtmCookieValue(cookieValue: string): string {
  try {
    return decodeURIComponent(cookieValue);
  } catch {
    return cookieValue;
  }
}

export function parseUtmCookie(
  cookieValue: string | undefined
): UtmData | null {
  if (!cookieValue) {
    return null;
  }

  try {
    const raw: RawUtmData = JSON.parse(cookieValue);

    return {
      utmSource: normalizeUtmValue(raw.utm_source),
      utmMedium: normalizeUtmValue(raw.utm_medium),
      utmCampaign: normalizeUtmValue(raw.utm_campaign),
      utmContent: normalizeUtmValue(raw.utm_content),
      utmTerm: normalizeUtmValue(raw.utm_term),
    };
  } catch {
    return null;
  }
}
