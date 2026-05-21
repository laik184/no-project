/**
 * server/memory/claims/claim-validator.ts
 *
 * ClaimValidator — validates claim structure before writing to ClaimStore.
 * Also verifies checksum integrity of existing claims.
 * No I/O. No state. Pure validation logic.
 */

import type { AgentClaim } from "../contracts/types.ts";
import type { ChecksumEngine } from "../infrastructure/checksum.ts";

export type ClaimValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

const MAX_CLAIM_LENGTH = 2000;
const MIN_CONFIDENCE   = 0.01;
const MAX_CONFIDENCE   = 0.99;

export class ClaimValidator {
  constructor(private readonly _checksum: ChecksumEngine) {}

  validateInput(
    claim: string,
    namespace: string,
    sourceRunId: string,
    confidence: number,
  ): ClaimValidationResult {
    if (!claim || typeof claim !== "string" || claim.trim().length === 0) {
      return { valid: false, reason: "claim text must be a non-empty string" };
    }
    if (claim.length > MAX_CLAIM_LENGTH) {
      return { valid: false, reason: `claim exceeds ${MAX_CLAIM_LENGTH} characters` };
    }
    if (!namespace || typeof namespace !== "string") {
      return { valid: false, reason: "namespace required" };
    }
    if (!sourceRunId || typeof sourceRunId !== "string") {
      return { valid: false, reason: "sourceRunId required" };
    }
    if (typeof confidence !== "number" || confidence < MIN_CONFIDENCE || confidence > MAX_CONFIDENCE) {
      return { valid: false, reason: `confidence must be ${MIN_CONFIDENCE}–${MAX_CONFIDENCE}` };
    }
    // Safety: reject self-confirming language that could cause recursive hallucination
    const selfConfirm = [
      /i (have|just|already) (completed|finished|done|verified)/i,
      /successfully (completed|finished|implemented|deployed)/i,
      /(it )?works? (correctly|properly|as expected)/i,
    ];
    for (const pattern of selfConfirm) {
      if (pattern.test(claim)) {
        return {
          valid: false,
          reason: "claim contains self-confirming language; use verified facts instead",
        };
      }
    }
    return { valid: true };
  }

  verifyIntegrity(claim: AgentClaim): ClaimValidationResult {
    const body = {
      claim: claim.claim,
      namespace: claim.namespace,
      sourceRunId: claim.sourceRunId,
    };
    if (!this._checksum.verify(body, claim.checksum)) {
      return { valid: false, reason: `claim ${claim.id} checksum mismatch — possible tampering` };
    }
    return { valid: true };
  }
}
