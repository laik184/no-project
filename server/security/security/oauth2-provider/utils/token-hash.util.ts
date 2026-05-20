import { sha256Hex, generateSecureRandom } from "./crypto.util.js";

export interface HashedToken {
  readonly raw: string;
  readonly hash: string;
}

export function generateHashedToken(): HashedToken {
  const raw = generateSecureRandom(48);
  const hash = sha256Hex(raw);
  return Object.freeze({ raw, hash });
}

export function hashToken(raw: string): string {
  return sha256Hex(raw);
}

export function matchesHash(raw: string, hash: string): boolean {
  return sha256Hex(raw) === hash;
}
