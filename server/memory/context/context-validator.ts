/**
 * server/memory/context/context-validator.ts
 *
 * ContextValidator — verifies integrity of assembled context blocks before
 * they are injected into LLM prompts. Detects tampering, drift, and
 * blocks that violate injection safety rules.
 */

import type { ContextBlock } from "../contracts/types.ts";
import type { ChecksumEngine } from "../infrastructure/checksum.ts";
import { factToBlock, claimToBlock } from "./context-types.ts";

export type ContextValidationReport = {
  readonly valid: boolean;
  readonly blocksChecked: number;
  readonly invalidBlocks: readonly string[];
  readonly warnings: readonly string[];
};

export class ContextValidator {
  constructor(private readonly _checksum: ChecksumEngine) {}

  /**
   * Validates an assembled context block set before prompt injection.
   * Returns a full integrity report — never throws.
   */
  validate(blocks: readonly ContextBlock[]): ContextValidationReport {
    const invalidBlocks: string[] = [];
    const warnings: string[] = [];

    for (const block of blocks) {
      // 1. Checksum integrity
      const recomputed = this._checksum.compute({ content: block.content, sourceId: block.sourceId, kind: block.kind });
      if (recomputed !== block.checksum) {
        invalidBlocks.push(block.id);
        continue;
      }

      // 2. Unverified claims MUST carry the [CLAIM — UNVERIFIED] marker
      if (block.kind === "UNVERIFIED_CLAIM" && !block.content.includes("[CLAIM — UNVERIFIED")) {
        invalidBlocks.push(block.id);
        continue;
      }

      // 3. Verified facts MUST carry the [VERIFIED — ...] marker
      if (block.kind === "VERIFIED_FACT" && !block.content.includes("[VERIFIED —")) {
        invalidBlocks.push(block.id);
        continue;
      }

      // 4. Confidence < 0.2 on an injected block is suspicious
      if (block.confidence < 0.2 && block.kind !== "VERIFIED_FACT") {
        warnings.push(`block ${block.id} has very low confidence (${block.confidence})`);
      }
    }

    return Object.freeze({
      valid:          invalidBlocks.length === 0,
      blocksChecked:  blocks.length,
      invalidBlocks:  Object.freeze(invalidBlocks),
      warnings:       Object.freeze(warnings),
    });
  }

  /**
   * Verifies that the provenance string matches the block set.
   * Used to detect context substitution attacks.
   */
  verifyProvenance(blocks: readonly ContextBlock[], provenance: string): boolean {
    const expected = blocks
      .map((b) => `${b.kind}:${b.sourceId}:${b.checksum.slice(0, 8)}`)
      .join("|");
    return expected === provenance;
  }
}
