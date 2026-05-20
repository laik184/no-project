import { createHash, createHmac, randomBytes, timingSafeEqual as cryptoTimingSafeEqual } from "crypto";

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hmacSHA1(key: Buffer, data: Buffer): Buffer {
  return createHmac("sha1", key).update(data).digest();
}

export function secureRandomBytes(length: number): Buffer {
  return randomBytes(length);
}

export function secureRandomHex(byteLength: number): string {
  return randomBytes(byteLength).toString("hex");
}

export function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  return cryptoTimingSafeEqual(aBuf, bBuf);
}

export function base32Encode(buf: Buffer): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let output = "";
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | (buf[i] as number);
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  const cleaned = input.toUpperCase().replace(/=+$/, "");
  for (const char of cleaned) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}
