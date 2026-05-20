import { secureRandomHex } from "./crypto.util.js";

export const KEY_PREFIX_LENGTH = 8;
export const KEY_SECRET_BYTES = 32;
export const KEY_SEPARATOR = "_";

export function buildApiKey(prefix: string): { raw: string; keyPrefix: string } {
  const secret = secureRandomHex(KEY_SECRET_BYTES);
  const raw = `${prefix}${KEY_SEPARATOR}${secret}`;
  const keyPrefix = raw.slice(0, KEY_PREFIX_LENGTH + prefix.length + KEY_SEPARATOR.length);
  return { raw, keyPrefix };
}

export function extractPrefix(rawKey: string, prefixLength: number): string {
  return rawKey.slice(0, prefixLength);
}

export function isValidKeyFormat(rawKey: string): boolean {
  return /^[a-z0-9]+_[a-f0-9]{64}$/.test(rawKey);
}
