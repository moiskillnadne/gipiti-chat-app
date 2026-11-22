/**
 * The platforms an account can be created from through the API. An account
 * created on the website has none (`User.signup_platform` is null).
 */
export const SIGNUP_PLATFORMS = ["ios", "android"] as const;

export type SignupPlatform = (typeof SIGNUP_PLATFORMS)[number];
