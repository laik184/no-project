/**
 * server/memory/infrastructure/checksum.ts
 *
 * ChecksumEngine — deterministic SHA-256 digests over arbitrary data.
 * Used for tamper detection, event chain integrity, and fact fingerprinting.
 * No state. Pure functions + injectable class wrapper.
 */

import { createHash } from "crypto";
import type { ChecksumHex } from "../contracts/types.ts";

// ── Pure functions ────────────────────────────────────────────────────────────

export function computeChecksum(data: unknown): ChecksumHex {
  const serialized = stableStringify(data);
  return createHash("sha256").update(serialized, "utf8").digest("hex");
}

export function verifyChecksum(data: unknown, expected: ChecksumHex): boolean {
  return computeChecksum(data) === expected;
}

export function chainHash(previousHash: ChecksumHex, payload: unknown): ChecksumHex {
  return createHash("sha256")
    .update(previousHash, "hex")
    .update(stableStringify(payload), "utf8")
    .digest("hex");
}

export const GENESIS_HASH: ChecksumHex = "0".repeat(64);

// ── Stable serialization (key-sorted JSON) ────────────────────────────────────
// Required for deterministic checksums regardless of insertion order.

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") + "}";
}

// ── Injectable class wrapper ──────────────────────────────────────────────────

export class ChecksumEngine {
  compute(data: unknown): ChecksumHex    { return computeChecksum(data); }
  verify(data: unknown, expected: ChecksumHex): boolean { return verifyChecksum(data, expected); }
  chain(prev: ChecksumHex, payload: unknown): ChecksumHex { return chainHash(prev, payload); }
}
