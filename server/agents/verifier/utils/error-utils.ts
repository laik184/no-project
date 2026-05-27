export function normalizeError(err: unknown): Error {
  if (err instanceof Error) return err;
  if (typeof err === 'string') return new Error(err);
  try {
    return new Error(JSON.stringify(err));
  } catch {
    return new Error('[unserializable error]');
  }
}

export function extractMessage(err: unknown): string {
  return normalizeError(err).message;
}

export function isNodeError(err: unknown, code: string): boolean {
  return (
    err instanceof Error &&
    'code' in err &&
    (err as NodeJS.ErrnoException).code === code
  );
}

export function toStringError(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  return String(value);
}

export function limitLength(text: string, maxChars = 2000): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + `\n... [truncated ${text.length - maxChars} chars]`;
}

export function collectErrors(results: Array<{ errors: string[] }>): string[] {
  return results.flatMap((r) => r.errors);
}

export function collectWarnings(results: Array<{ warnings: string[] }>): string[] {
  return results.flatMap((r) => r.warnings ?? []);
}
