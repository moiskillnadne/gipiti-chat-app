import crypto from "node:crypto";

const BEARER_PREFIX = "Bearer ";

/**
 * True when the request carries `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Without a configured secret nothing is authorized. Building the expected
 * header straight from the env var would turn a missing secret into the
 * literal `Bearer undefined`, which anyone can send.
 */
export const isAuthorizedCronRequest = (request: Request): boolean => {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return false;
  }

  const authorizationHeader = request.headers.get("authorization");
  if (!authorizationHeader?.startsWith(BEARER_PREFIX)) {
    return false;
  }

  // Hash both sides so the constant-time compare gets equal-length inputs.
  const providedDigest = crypto
    .createHash("sha256")
    .update(authorizationHeader.slice(BEARER_PREFIX.length))
    .digest();
  const expectedDigest = crypto
    .createHash("sha256")
    .update(cronSecret)
    .digest();

  return crypto.timingSafeEqual(providedDigest, expectedDigest);
};
