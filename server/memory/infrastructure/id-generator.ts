/**
 * server/memory/infrastructure/id-generator.ts
 *
 * IdGenerator — deterministic, collision-resistant ID production.
 * Wraps crypto.randomUUID() so consumers never import crypto directly.
 * Supports prefixed IDs for visual debuggability.
 */

import { randomUUID } from "crypto";

export type IdPrefix = "fact" | "claim" | "evid" | "evnt" | "ctx" | "gov" | "promo" | "sess";

export class IdGenerator {
  generate(prefix?: IdPrefix): string {
    const uuid = randomUUID().replace(/-/g, "").slice(0, 16);
    return prefix ? `${prefix}_${uuid}` : uuid;
  }

  generateSequential(prefix: IdPrefix, seq: number): string {
    return `${prefix}_${String(seq).padStart(8, "0")}`;
  }
}

// Convenience singleton-free factory for callers that only need one ID
export function generateId(prefix?: IdPrefix): string {
  return new IdGenerator().generate(prefix);
}
