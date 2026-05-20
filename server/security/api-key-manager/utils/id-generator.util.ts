import { secureRandomHex } from "./crypto.util.js";

export function generateKeyId(): string {
  return `key_${secureRandomHex(12)}`;
}
