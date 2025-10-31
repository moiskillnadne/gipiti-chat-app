import { isDevelopmentEnvironment } from "@/lib/constants";

const DEVELOPMENT_AUTH_SECRET = "development-auth-secret";

export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

  if (secret && secret.length > 0) {
    return secret;
  }

  if (isDevelopmentEnvironment) {
    return DEVELOPMENT_AUTH_SECRET;
  }

  throw new Error(
    "Missing AUTH_SECRET or NEXTAUTH_SECRET environment variable. Set one of them to enable authentication."
  );
}
