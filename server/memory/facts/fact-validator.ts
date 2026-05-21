/**
 * server/memory/facts/fact-validator.ts
 *
 * FactValidator — validates evidence requirements and checksums before a fact
 * is written to the FactStore. Enforces the invariants that prevent LLM
 * self-promotion and checksum tampering.
 */

import type { VerifiedFact, Evidence } from "../contracts/types.ts";
import type { ChecksumEngine } from "../infrastructure/checksum.ts";

export type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

export class FactValidator {
  constructor(
    private readonly _checksum: ChecksumEngine,
    private readonly _minEvidenceCount: number = 1,
  ) {}

  /**
   * Validates the inputs for a new fact before writing.
   * Called by PromotionPipeline — not by FactStore itself.
   */
  validateInputs(
    key: string,
    value: unknown,
    verifier: string,
    evidence: readonly Evidence[],
    namespace: string,
  ): ValidationResult {
    if (!key || typeof key !== "string" || key.trim().length === 0) {
      return { valid: false, reason: "key must be a non-empty string" };
    }
    if (!verifier || typeof verifier !== "string") {
      return { valid: false, reason: "verifier must be a non-empty string" };
    }
    if (!namespace || typeof namespace !== "string") {
      return { valid: false, reason: "namespace required" };
    }
    if (value === undefined) {
      return { valid: false, reason: "value must be defined (use null for absent)" };
    }
    if (evidence.length < this._minEvidenceCount) {
      return {
        valid: false,
        reason: `requires at least ${this._minEvidenceCount} evidence item(s), got ${evidence.length}`,
      };
    }
    for (const ev of evidence) {
      if (!this._checksum.verify(ev.data, ev.checksum)) {
        return { valid: false, reason: `evidence ${ev.id} checksum tampered` };
      }
    }
    return { valid: true };
  }

  /**
   * Verifies an existing stored fact's checksum integrity.
   */
  verifyIntegrity(fact: VerifiedFact): ValidationResult {
    const body = {
      key: fact.key, namespace: fact.namespace, value: fact.value,
      evidenceIds: fact.evidenceIds, verifiedAt: fact.verifiedAt, verifier: fact.verifier,
    };
    if (!this._checksum.verify(body, fact.checksum)) {
      return { valid: false, reason: `fact ${fact.id} checksum mismatch — possible tampering` };
    }
    return { valid: true };
  }

  /**
   * Validates that the evidence array covers the claimed evidenceIds.
   */
  validateEvidenceCoverage(
    evidenceIds: readonly string[],
    evidence: readonly Evidence[],
  ): ValidationResult {
    const provided = new Set(evidence.map((e) => e.id));
    const missing = evidenceIds.filter((id) => !provided.has(id));
    if (missing.length > 0) {
      return { valid: false, reason: `missing evidence: ${missing.join(", ")}` };
    }
    return { valid: true };
  }
}
