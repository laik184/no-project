/**
 * patch-validation-barrier.ts
 *
 * Pre-application validation gate for FilePatch objects.
 * Single responsibility: validate patches BEFORE they enter the transactional pipeline.
 *
 * Validation rules:
 *   1. filePath must be non-empty and relative (no absolute paths)
 *   2. "create" and "update" operations must have non-empty content
 *   3. "delete" operation must NOT have content
 *   4. Confidence must be in [0, 1]
 *   5. No path traversal sequences ("../") allowed
 *
 * Fail-closed: any invalid patch is rejected with a typed reason.
 * Telemetry: emits patch.validated for every patch (valid or not).
 */

import type { FilePatch } from "../contracts/specialist.contracts.ts";
import { emitPatchValidated } from "../telemetry/merge-telemetry.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ValidationFailureReason =
  | "empty_file_path"
  | "absolute_path"
  | "path_traversal"
  | "missing_content"
  | "unexpected_content"
  | "invalid_confidence"
  | "unknown_operation";

export interface PatchValidationResult {
  patch:   FilePatch;
  valid:   boolean;
  reason?: ValidationFailureReason;
  detail?: string;
}

export interface BarrierResult {
  valid:    PatchValidationResult[];
  rejected: PatchValidationResult[];
  allValid: boolean;
}

// ── Validator ─────────────────────────────────────────────────────────────────

export class PatchValidationBarrier {
  /** Validate a single patch. */
  validateOne(runId: string, patch: FilePatch): PatchValidationResult {
    const fail = (reason: ValidationFailureReason, detail: string): PatchValidationResult => {
      emitPatchValidated(runId, patch.filePath, false, reason);
      return { patch, valid: false, reason, detail };
    };

    if (!patch.filePath || patch.filePath.trim() === "") {
      return fail("empty_file_path", "filePath is empty or whitespace");
    }

    if (patch.filePath.startsWith("/") || /^[A-Za-z]:/.test(patch.filePath)) {
      return fail("absolute_path", `Absolute path rejected: ${patch.filePath}`);
    }

    if (patch.filePath.includes("../") || patch.filePath.includes("..\\")) {
      return fail("path_traversal", `Path traversal detected: ${patch.filePath}`);
    }

    if (!["create", "update", "delete"].includes(patch.operation)) {
      return fail("unknown_operation", `Unknown operation: ${patch.operation}`);
    }

    if (patch.operation === "create" || patch.operation === "update") {
      if (!patch.content || patch.content.trim() === "") {
        return fail("missing_content", `Operation "${patch.operation}" requires non-empty content`);
      }
    }

    if (patch.operation === "delete" && patch.content !== undefined && patch.content !== "") {
      return fail("unexpected_content", `Delete operation should not carry content`);
    }

    if (typeof patch.confidence !== "number" || patch.confidence < 0 || patch.confidence > 1) {
      return fail("invalid_confidence", `Confidence out of range: ${patch.confidence}`);
    }

    emitPatchValidated(runId, patch.filePath, true);
    return { patch, valid: true };
  }

  /** Validate a batch of patches. */
  validateAll(runId: string, patches: FilePatch[]): BarrierResult {
    const results  = patches.map(p => this.validateOne(runId, p));
    const valid    = results.filter(r => r.valid);
    const rejected = results.filter(r => !r.valid);
    return { valid, rejected, allValid: rejected.length === 0 };
  }

  /** Filter to only valid patches, discarding rejected with telemetry already emitted. */
  filter(runId: string, patches: FilePatch[]): FilePatch[] {
    return this.validateAll(runId, patches).valid.map(r => r.patch);
  }
}

export const patchValidationBarrier = new PatchValidationBarrier();
