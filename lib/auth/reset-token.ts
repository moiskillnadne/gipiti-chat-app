import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Generate a cryptographically secure random token
 * @param bytes Number of random bytes (default: 32)
 * @returns Hex-encoded token string
 */
export function generateResetToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

/**
 * Hash a token using SHA-256
 * Used to store tokens securely in the database
 * @param token The plain token to hash
 * @returns Hex-encoded hash string
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Verify a token against a hashed token using timing-safe comparison
 * @param token The plain token to verify
 * @param hashedToken The stored hash to compare against
 * @returns True if tokens match
 */
export function verifyToken(token: string, hashedToken: string): boolean {
  const tokenHash = hashToken(token);

  // Convert to buffers for timing-safe comparison
  const tokenBuffer = Buffer.from(tokenHash, "hex");
  const hashedBuffer = Buffer.from(hashedToken, "hex");

  // Ensure buffers are the same length
  if (tokenBuffer.length !== hashedBuffer.length) {
    return false;
  }

  return timingSafeEqual(tokenBuffer, hashedBuffer);
}

/**
 * Create a password reset token with expiry
 * @param expiryHours Number of hours until token expires (default: 1)
 * @returns Object with plain token, hashed token, and expiry date
 */
export function createPasswordResetToken(expiryHours = 1): {
  token: string;
  hashedToken: string;
  expiresAt: Date;
} {
  const token = generateResetToken();
  const hashedToken = hashToken(token);
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

  return {
    token, // Send this in the email
    hashedToken, // Store this in the database
    expiresAt,
  };
}

/**
 * Check if a token has expired
 * @param expiryDate The token expiry timestamp
 * @returns True if token is expired
 */
export function isTokenExpired(expiryDate: Date | null): boolean {
  if (!expiryDate) {
    return true;
  }
  return new Date() > expiryDate;
}
