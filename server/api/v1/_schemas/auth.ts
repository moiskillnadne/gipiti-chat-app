import { z } from "zod/v4";

import { openEnum } from "@/server/api/_kit/open-enum";
import { meSchema } from "@/server/api/v1/_schemas/me";

/** The platforms an API client can sign in from. */
export const KNOWN_CLIENT_PLATFORMS = ["ios", "android"] as const;

const KNOWN_TOKEN_TYPES = ["Bearer"] as const;

const MAX_EMAIL_LENGTH = 255;
const MAX_PASSWORD_LENGTH = 200;
const MAX_DEVICE_NAME_LENGTH = 255;
const MAX_APP_VERSION_LENGTH = 32;
const MIN_REFRESH_TOKEN_LENGTH = 20;
const MAX_REFRESH_TOKEN_LENGTH = 200;

export const emailSchema = z.email().max(MAX_EMAIL_LENGTH);

/** A password as typed. The strength rule is applied where one is set. */
export const passwordInputSchema = z.string().min(1).max(MAX_PASSWORD_LENGTH);

/** What the app tells about itself when it opens a session. */
export const clientInfoSchema = z.object({
  platform: z.enum(KNOWN_CLIENT_PLATFORMS),
  deviceName: z
    .string()
    .trim()
    .min(1)
    .max(MAX_DEVICE_NAME_LENGTH)
    .optional()
    .meta({
      description:
        'Shown in the list of sessions, for example "Anna\'s iPhone".',
    }),
  appVersion: z.string().trim().min(1).max(MAX_APP_VERSION_LENGTH).optional(),
});

export const tokenPairSchema = z.object({
  tokenType: openEnum(KNOWN_TOKEN_TYPES),
  accessToken: z.string().meta({
    description:
      "Sent as `Authorization: Bearer <accessToken>`. Treat it as opaque.",
  }),
  accessTokenExpiresAt: z.string().meta({
    description: "ISO 8601, UTC. Refresh a little before this moment.",
  }),
  refreshToken: z.string().meta({
    description:
      "Trades for a new pair at `POST /auth/refresh`, once. Keep it in the device's secure storage.",
  }),
  refreshTokenExpiresAt: z.string().meta({ description: "ISO 8601, UTC." }),
});

export type TokenPairDto = z.infer<typeof tokenPairSchema>;

export const loginInputSchema = z.object({
  email: emailSchema,
  password: passwordInputSchema,
  client: clientInfoSchema,
});

export const loginOutputSchema = z.object({
  user: meSchema,
  tokens: tokenPairSchema,
});

export const refreshInputSchema = z.object({
  refreshToken: z
    .string()
    .min(MIN_REFRESH_TOKEN_LENGTH)
    .max(MAX_REFRESH_TOKEN_LENGTH),
});

export const refreshOutputSchema = z.object({ tokens: tokenPairSchema });

/** A signed-in API client, for the list of devices. */
export const authSessionSchema = z.object({
  id: z.string(),
  platform: openEnum(KNOWN_CLIENT_PLATFORMS).nullable(),
  deviceName: z.string().nullable(),
  appVersion: z.string().nullable(),
  createdAt: z.string().meta({ description: "ISO 8601, UTC." }),
  lastUsedAt: z.string().meta({
    description: "ISO 8601, UTC. Updated at most every 5 minutes.",
  }),
  isCurrent: z.boolean().meta({
    description: "The session this request was made with.",
  }),
});

export type AuthSessionDto = z.infer<typeof authSessionSchema>;

export const authSessionListSchema = z.object({
  items: z.array(authSessionSchema),
});

export const authSessionIdInputSchema = z.object({ sessionId: z.uuid() });

const MAX_LANGUAGE_LENGTH = 35;
const MAX_UTM_VALUE_LENGTH = 255;
const MAX_RESET_TOKEN_LENGTH = 200;
const VERIFICATION_CODE_PATTERN = /^\d{6}$/;

const utmValueSchema = z.string().max(MAX_UTM_VALUE_LENGTH).optional();

/** Where the user came from, as the app knows it (an install referrer). */
export const utmSchema = z.object({
  source: utmValueSchema,
  medium: utmValueSchema,
  campaign: utmValueSchema,
  content: utmValueSchema,
  term: utmValueSchema,
});

export const registerInputSchema = z.object({
  email: emailSchema,
  password: passwordInputSchema.meta({
    description:
      "At least 8 characters with an uppercase letter, a lowercase letter, a digit and a special character.",
  }),
  language: z.string().max(MAX_LANGUAGE_LENGTH).optional().meta({
    description: "The device language as a BCP 47 tag, for example `ru-RU`.",
  }),
  utm: utmSchema.optional(),
  client: clientInfoSchema,
});

export const registerOutputSchema = z.object({
  user: meSchema,
  tokens: tokenPairSchema.nullable().meta({
    description:
      "The session of the new account. Always present for `ios` and `android`; declared nullable for clients that sign in another way.",
  }),
});

export const sendVerificationOutputSchema = z.object({
  cooldownSeconds: z.number().int().meta({
    description: "How long until another code can be asked for.",
  }),
});

export const verifyEmailInputSchema = z.object({
  code: z.string().regex(VERIFICATION_CODE_PATTERN).meta({
    description: "The 6 digits from the email.",
  }),
});

export const verifyEmailOutputSchema = z.object({
  emailVerified: z.boolean(),
  bonusGranted: z.boolean().meta({
    description: "The email-confirmation bonus was credited by this call.",
  }),
  welcomeGrantCredited: z.boolean().meta({
    description:
      "The welcome grant was credited by this call. An account created through this API receives it here, not at registration.",
  }),
});

export const forgotPasswordInputSchema = z.object({ email: emailSchema });

export const resetPasswordInputSchema = z.object({
  token: z.string().min(1).max(MAX_RESET_TOKEN_LENGTH).meta({
    description: "The token from the link in the reset email.",
  }),
  password: passwordInputSchema,
});

export const changePasswordInputSchema = z.object({
  currentPassword: passwordInputSchema,
  newPassword: passwordInputSchema,
});

export const changePasswordOutputSchema = z.object({
  tokens: tokenPairSchema.nullable().meta({
    description:
      "A new pair for a caller with an access token, whose old session ended with the change. Null for a browser session, which gets a fresh cookie instead.",
  }),
});

/** `data.reason` of a 400 from the auth endpoints. */
export const KNOWN_BAD_REQUEST_REASONS = [
  "weak_password",
  "disposable_email",
  "invalid_code",
  "expired_code",
  "invalid_token",
] as const;

export const badRequestReasonDataSchema = z.object({
  reason: openEnum(KNOWN_BAD_REQUEST_REASONS),
  attemptsLeft: z.number().int().optional().meta({
    description:
      "With `invalid_code`: how many more guesses the current code allows. 0 means a new code has to be asked for.",
  }),
});

/** `data.reason` of a 409 from the auth endpoints. */
export const KNOWN_CONFLICT_REASONS = [
  "email_taken",
  "already_verified",
] as const;

export const conflictReasonDataSchema = z.object({
  reason: openEnum(KNOWN_CONFLICT_REASONS),
});

/** `data.reason` of a 403 from the auth endpoints. */
export const KNOWN_FORBIDDEN_REASONS = [
  "signup_disabled",
  "cross_site_request",
] as const;

export const forbiddenReasonDataSchema = z.object({
  reason: openEnum(KNOWN_FORBIDDEN_REASONS),
});

/** `data` of a 429 from the auth endpoints. */
export const tooManyRequestsDataSchema = z
  .object({
    reason: openEnum(["too_many_attempts"] as const).optional(),
    retryAfterSeconds: z.number().int().optional(),
  })
  .optional();

/** `data.reason` of a 401 from the auth endpoints. */
export const KNOWN_UNAUTHORIZED_REASONS = [
  "not_authenticated",
  "invalid_token",
  "unsupported_authorization",
  "bearer_required",
  "invalid_credentials",
  "refresh_invalid",
  "refresh_expired",
  "session_revoked",
  "refresh_reused",
] as const;

export const unauthorizedReasonDataSchema = z.object({
  reason: openEnum(KNOWN_UNAUTHORIZED_REASONS),
});
