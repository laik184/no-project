/**
 * server/tools/filesystem/shared/filesystem-result.ts
 *
 * Thin wrappers to normalize raw agent results.
 * Tools use these to ensure consistent serializable output.
 */

export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

export function stripAbsolutePaths<T extends Record<string, unknown>>(
  obj: T,
  keySuffix = 'Absolute',
): Omit<T, string> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k.endsWith(keySuffix)) continue;
    out[k] = v;
  }
  return out as Omit<T, string>;
}
