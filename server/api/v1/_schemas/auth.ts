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
