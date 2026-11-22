import type {
  AuthSessionDto,
  TokenPairDto,
} from "@/server/api/v1/_schemas/auth";
import type { LiveAuthSession } from "@/server/modules/auth/queries/auth-sessions";
import type { TokenPair } from "@/server/modules/auth/sessions";

export const toTokenPairDto = ({
  accessToken,
  accessTokenExpiresAt,
  refreshToken,
  refreshTokenExpiresAt,
}: TokenPair): TokenPairDto => ({
  tokenType: "Bearer",
  accessToken,
  accessTokenExpiresAt: accessTokenExpiresAt.toISOString(),
  refreshToken,
  refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
});

export const toAuthSessionDto = (
  session: LiveAuthSession,
  currentSessionId: string | null
): AuthSessionDto => ({
  id: session.id,
  platform: session.platform,
  deviceName: session.deviceName,
  appVersion: session.appVersion,
  createdAt: session.createdAt.toISOString(),
  lastUsedAt: session.lastUsedAt.toISOString(),
  isCurrent: session.id === currentSessionId,
});
