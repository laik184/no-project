import { createHash, randomBytes, timingSafeEqual as cryptoTimingSafeEqual } from "crypto";

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function secureRandomBytes(length: number): Buffer {
  return randomBytes(length);
}

export function secureRandomHex(byteLength: number): string {
  return randomBytes(byteLength).toString("hex");
}

export function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  try {
    return cryptoTimingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}
