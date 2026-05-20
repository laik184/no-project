import { createHash, randomBytes } from "crypto";

export function generateSecureRandom(byteLength: number = 32): string {
  return randomBytes(byteLength).toString("hex");
}

export function sha256Base64Url(input: string): string {
  return createHash("sha256")
    .update(input)
    .digest("base64url");
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function verifyPkceChallenge(verifier: string, challenge: string): boolean {
  const computed = sha256Base64Url(verifier);
  return computed === challenge;
}

export function hashSecret(secret: string): string {
  return sha256Hex(secret);
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
