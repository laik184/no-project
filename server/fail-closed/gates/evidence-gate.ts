/**
 * server/fail-closed/gates/evidence-gate.ts
 *
 * EvidenceGate — strict evidence requirement enforcement.
 *
 * RULE: NO EVIDENCE = NO SUCCESS
 *
 * Every claim type has a minimum set of required evidence kinds.
 * If any required kind is missing OR expired OR false, the gate BLOCKS.
 * There is no partial-pass mode. Gates are binary: OPEN or BLOCKED.
 *
 * This is the primary anti-hallucination barrier.
 */

import type { Evidence, EvidenceKind, VerificationStage } from "../contracts/types.ts";

export type GateResult =
  | { passed: true;  evidence: readonly Evidence[] }
  | { passed: false; missing: readonly EvidenceKind[]; failed: readonly EvidenceKind[]; stale: readonly EvidenceKind[] };

// Minimum required evidence per stage
const STAGE_REQUIREMENTS: Record<VerificationStage, readonly EvidenceKind[]> = {
  STATIC:               ["IMPORT_GRAPH_CLEAN", "STATIC_ANALYSIS_CLEAN"],
  BUILD:                ["TSC_EXIT_0", "NPM_DEPS_INTACT"],
  RUNTIME:              ["PROCESS_ALIVE", "NO_CRASH_LOOP", "PORT_OPEN"],
  PREVIEW:              ["HTTP_200_STABLE", "PREVIEW_DOM_VALID", "PREVIEW_NO_FATAL_ERRORS"],
  STATE_RECONCILIATION: ["POSTCONDITIONS_MET"],
};

// TTL overrides: some evidence ages faster than others (ms)
const EVIDENCE_MAX_AGE: Partial<Record<EvidenceKind, number>> = {
  PROCESS_ALIVE:        10_000,   // 10s
  HTTP_200_STABLE:      15_000,   // 15s
  NO_CRASH_LOOP:        10_000,
  PORT_OPEN:            10_000,
  TSC_EXIT_0:           30_000,   // 30s
  IMPORT_GRAPH_CLEAN:   30_000,
  PREVIEW_DOM_VALID:    20_000,   // 20s
  NPM_DEPS_INTACT:      60_000,   // 60s
};

export class EvidenceGate {

  evaluate(stage: VerificationStage, evidence: readonly Evidence[]): GateResult {
    const required = STAGE_REQUIREMENTS[stage];
    const now = Date.now();

    const missing: EvidenceKind[]  = [];
    const failed:  EvidenceKind[]  = [];
    const stale:   EvidenceKind[]  = [];
    const valid:   Evidence[]      = [];

    for (const kind of required) {
      const item = evidence.find((e) => e.kind === kind);

      if (!item) {
        missing.push(kind);
        continue;
      }

      // Freshness check
      const maxAge = EVIDENCE_MAX_AGE[kind] ?? item.ttlMs;
      if (now - item.collectedAt > maxAge) {
        stale.push(kind);
        continue;
      }

      // Value check — false evidence is not acceptable
      if (!item.value) {
        failed.push(kind);
        continue;
      }

      valid.push(item);
    }

    if (missing.length > 0 || failed.length > 0 || stale.length > 0) {
      return { passed: false, missing, failed, stale };
    }

    return { passed: true, evidence: Object.freeze(valid) };
  }

  /**
   * Returns a human-readable denial reason for audit logs.
   */
  describeFailure(stage: VerificationStage, result: Extract<GateResult, { passed: false }>): string {
    const parts: string[] = [`EvidenceGate BLOCKED for stage ${stage}.`];
    if (result.missing.length)  parts.push(`Missing: ${result.missing.join(", ")}`);
    if (result.failed.length)   parts.push(`Failed:  ${result.failed.join(", ")}`);
    if (result.stale.length)    parts.push(`Stale:   ${result.stale.join(", ")}`);
    return parts.join(" ");
  }

  /** Returns the full set of required evidence kinds for a stage. */
  requiredFor(stage: VerificationStage): readonly EvidenceKind[] {
    return STAGE_REQUIREMENTS[stage];
  }

  /** Checks whether ALL required evidence for a stage is present and fresh. */
  isStageCovered(stage: VerificationStage, evidence: readonly Evidence[]): boolean {
    return this.evaluate(stage, evidence).passed;
  }
}
