import type { UtmData } from "./constants";

type RawUtmData = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
};

export function parseUtmCookie(
  cookieValue: string | undefined
): UtmData | null {
  if (!cookieValue) {
    return null;
  }

  try {
    const raw: RawUtmData = JSON.parse(cookieValue);

    return {
      utmSource: raw.utm_source ?? null,
      utmMedium: raw.utm_medium ?? null,
      utmCampaign: raw.utm_campaign ?? null,
      utmContent: raw.utm_content ?? null,
      utmTerm: raw.utm_term ?? null,
    };
  } catch {
    return null;
  }
}
