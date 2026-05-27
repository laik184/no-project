export function assertDefined<T>(
  value:   T | undefined | null,
  label:   string,
): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error(`[verifier] Required value missing: ${label}`);
  }
}

export function isNonEmpty(value: string | undefined | null): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function coerceBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() !== 'false' && value !== '0';
  if (typeof value === 'number') return value !== 0;
  return Boolean(value);
}

export function isSuccessExitCode(code: number): boolean {
  return code === 0;
}

export function countOccurrences(text: string, pattern: string): number {
  let count = 0;
  let pos = 0;
  while ((pos = text.indexOf(pattern, pos)) !== -1) {
    count++;
    pos += pattern.length;
  }
  return count;
}

export function clampCount(value: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  return Math.min(Math.max(value, min), max);
}

export function pickDefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null),
  ) as Partial<T>;
}
