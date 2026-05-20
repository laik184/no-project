export const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const MS_PER_MINUTE = 60 * 1000;

export function daysFromNow(days: number): number {
  return Date.now() + days * MS_PER_DAY;
}

export function isExpired(expiresAt: number | null): boolean {
  if (expiresAt === null) return false;
  return Date.now() > expiresAt;
}

export function nowMs(): number {
  return Date.now();
}

export function startOfCurrentMinute(): number {
  return Math.floor(Date.now() / MS_PER_MINUTE) * MS_PER_MINUTE;
}

export function startOfCurrentDay(): number {
  return Math.floor(Date.now() / MS_PER_DAY) * MS_PER_DAY;
}

export function isInSameDay(timestamp: number): boolean {
  return timestamp >= startOfCurrentDay();
}

export function isInSameMinute(timestamp: number): boolean {
  return timestamp >= startOfCurrentMinute();
}
