export const UTM_COOKIE_NAME = "utm_params";
export const UTM_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// Must match the varchar length of the utm_* columns in lib/db/schema.ts
export const UTM_MAX_VALUE_LENGTH = 255;

export type UtmData = {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
};
