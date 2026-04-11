/**
 * Check if current period has expired
 */
export function isPeriodExpired(periodEnd: Date): boolean {
  return new Date() >= periodEnd;
}
