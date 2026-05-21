/**
 * server/memory/verification/promotion-validator.ts
 *
 * PromotionValidator — the gate between CLAIM and FACT.
 * Validates that a promotion request satisfies all structural and
 * evidence requirements before the PromotionPipeline may proceed.
 * No I/O. No state. Pure validation.
 *
 * INVARIANT: A claim NEVER promotes itself. All verification is external.
 */

import type { AgentClaim, Evidence, PromotionRequest } from "../contracts/types.ts";
import type { FactValidator } from "../facts/fact-validator.ts";
import type { Clock } from "../infrastructure/clock.ts";

export type PromotionValidationResult =
  | { valid: true }
  | { valid: false; reason: string; fatal: boolean };

export class PromotionValidator {
  constructor(
    private readonly _factValidator: FactValidator,
    private readonly _clock: Clock,
  ) {}

  validate(
    request: PromotionRequest,
    claim: AgentClaim,
    value: unknown,
  ): PromotionValidationResult {
    // 1. Claim must exist and be unverified
    if (!claim) {
      return { valid: false, reason: "claim not found", fatal: true };
    }
    if (claim.verificationStatus !== "unverified") {
      return {
        valid: false,
        reason: `claim is already ${claim.verificationStatus} — cannot promote`,
        fatal: true,
      };
    }

    // 2. Claim must not be expired
    const now = this._clock.now();
    if (now >= claim.expiresAt) {
      return { valid: false, reason: "claim has expired before promotion", fatal: false };
    }

    // 3. Verifier must be a system tool, not the LLM itself
    const forbiddenVerifiers = ["llm", "agent", "model", "gpt", "claude", "ai"];
    if (forbiddenVerifiers.some((v) => request.verifier.toLowerCase().includes(v))) {
      return {
        valid: false,
        reason: `verifier "${request.verifier}" is not permitted — LLMs cannot self-verify`,
        fatal: true,
      };
    }

    // 4. Evidence must pass structural validation
    const factCheck = this._factValidator.validateInputs(
      claim.claim.slice(0, 100),
      value,
      request.verifier,
      request.evidence,
      request.namespace,
    );
    if (!factCheck.valid) {
      return { valid: false, reason: factCheck.reason, fatal: false };
    }

    // 5. Evidence checksums must all be valid
    for (const ev of request.evidence) {
      if (!ev.checksum || ev.checksum.length < 16) {
        return { valid: false, reason: `evidence ${ev.id} missing checksum`, fatal: true };
      }
    }

    return { valid: true };
  }

  /**
   * Validates that the derived fact key is deterministic and not claim text.
   * Fact keys should be stable identifiers like "server.port_3001.reachable".
   */
  validateFactKey(key: string): PromotionValidationResult {
    if (!key || key.length < 3) {
      return { valid: false, reason: "fact key too short", fatal: true };
    }
    if (key.length > 200) {
      return { valid: false, reason: "fact key too long (max 200 chars)", fatal: true };
    }
    if (/\s{2,}/.test(key) || /['"\\]/.test(key)) {
      return { valid: false, reason: "fact key must not contain quotes or double spaces", fatal: true };
    }
    return { valid: true };
  }
}
