import { headers } from "next/headers";

// Vercel attaches these headers to every incoming request at the edge.
const COUNTRY_HEADER = "x-vercel-ip-country";
const REGION_HEADER = "x-vercel-ip-country-region";
const CITY_HEADER = "x-vercel-ip-city";

// BCP-47-ish language tag, e.g. "ru", "ru-RU", "zh-Hant-TW".
const LANGUAGE_TAG_PATTERN = /^[a-z]{2,3}(-[a-z0-9]+)*$/i;
const MAX_LANGUAGE_LENGTH = 35;

export type RegistrationGeo = {
  country: string | null;
  region: string | null;
  city: string | null;
  language: string | null;
};

/**
 * The IP-derived portion of the registration geo, read from Vercel edge
 * headers. Returns nulls when the headers are absent (e.g. on localhost).
 */
export type RegistrationGeoHeaders = Pick<
  RegistrationGeo,
  "country" | "region" | "city"
>;

const decodeCity = (rawCity: string | null): string | null => {
  if (!rawCity) {
    return null;
  }

  // Vercel URL-encodes the city header (e.g. "San%20Francisco"). Fall back to
  // the raw value if it is somehow malformed.
  try {
    return decodeURIComponent(rawCity);
  } catch {
    return rawCity;
  }
};

export const getRegistrationGeoFromHeaders =
  async (): Promise<RegistrationGeoHeaders> => {
    // Geo is best-effort analytics: a failure to read the headers must never
    // break the registration flow, so fall back to nulls on any error.
    try {
      const requestHeaders = await headers();

      return {
        country: requestHeaders.get(COUNTRY_HEADER) ?? null,
        region: requestHeaders.get(REGION_HEADER) ?? null,
        city: decodeCity(requestHeaders.get(CITY_HEADER)),
      };
    } catch (error) {
      console.error("[registration-geo] failed to read geo headers:", error);
      return { country: null, region: null, city: null };
    }
  };

/**
 * The language is supplied by the client (navigator.language via a hidden
 * form field) and is therefore untrusted: accept only a well-formed,
 * length-capped BCP-47 tag, otherwise discard it.
 */
export const sanitizeLanguage = (
  value: FormDataEntryValue | null
): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (
    trimmed.length === 0 ||
    trimmed.length > MAX_LANGUAGE_LENGTH ||
    !LANGUAGE_TAG_PATTERN.test(trimmed)
  ) {
    return null;
  }

  return trimmed;
};
