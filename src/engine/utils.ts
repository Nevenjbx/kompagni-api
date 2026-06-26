/**
 * Calculates the number of days between the given date and the current date.
 */
export function getDaysPassed(date: Date): number {
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
