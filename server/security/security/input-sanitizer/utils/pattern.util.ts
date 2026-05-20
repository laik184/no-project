export const SAFE_PROTOCOLS = Object.freeze(["https", "http", "mailto", "ftp"]);

export const DEFAULT_MAX_STRING_LENGTH = 10_000;
export const DEFAULT_MAX_URL_LENGTH = 2_048;

export function isSafeProtocol(url: string, allowed: readonly string[] = SAFE_PROTOCOLS): boolean {
  try {
    const parsed = new URL(url);
    const proto = parsed.protocol.replace(":", "");
    return allowed.includes(proto);
  } catch {
    return false;
  }
}

export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ["http:", "https:", "mailto:", "ftp:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function exceedsMaxLength(input: string, max: number = DEFAULT_MAX_STRING_LENGTH): boolean {
  return input.length > max;
}

export function truncate(input: string, max: number = DEFAULT_MAX_STRING_LENGTH): string {
  return input.length > max ? input.slice(0, max) : input;
}
