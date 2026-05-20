import { base32Encode, secureRandomBytes, secureRandomHex } from "./hash.util.js";

export const SECRET_BYTE_LENGTH = 20;
export const BACKUP_CODE_COUNT = 10;
export const BACKUP_CODE_LENGTH = 10;

export function generateTOTPSecret(): string {
  const buf = secureRandomBytes(SECRET_BYTE_LENGTH);
  return base32Encode(buf);
}

export function generateOTPCode(digits: number = 6): string {
  const max = Math.pow(10, digits);
  const randomValue = parseInt(secureRandomHex(4), 16);
  return String(randomValue % max).padStart(digits, "0");
}

export function generateBackupCodes(count: number = BACKUP_CODE_COUNT): readonly string[] {
  return Object.freeze(
    Array.from({ length: count }, () => {
      const hex = secureRandomHex(Math.ceil(BACKUP_CODE_LENGTH / 2));
      return hex.slice(0, BACKUP_CODE_LENGTH).toUpperCase();
    }),
  );
}
