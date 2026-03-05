export const UTM_COOKIE_NAME = "utm_params";
export const UTM_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type UtmData = {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
};
