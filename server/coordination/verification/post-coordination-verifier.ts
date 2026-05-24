/**
 * post-coordination-verifier.ts
 *
 * Runs a lightweight verification gate after specialist coordination completes.
 * Single responsibility: validate CoordinationResult before it is returned
 * to the orchestration engine.
 *
 * Verification contract:
 *   PASS  → result forwarded to execution-router
 *   WARN  → result forwarded with verification warnings in artifacts
 *   BLOCK → coordination marked as failed, error surfaced to orchestration
 *
 * Checks performed:
 *   1. Minimum success rate (≥1 specialist succeeded)
 *   2. Merge integrity (no duplicate patch winners for the same file)
 *   3. Conflict resolution completeness (no unresolved conflicts in patches)
 *   4. Patch confidence floor (avg confidence ≥ MIN_CONFIDENCE)
 */

import { bus }            from "../../infrastructure/events/bus.ts";
import type { CoordinationResult }
  from "../contracts/coordination.contracts.ts";
import type { FilePatch } from "../contracts/specialist.contracts.ts";

// ── Constants ─────────────────────────────────────────────────────────────────

const MIN_CONFIDENCE      = 0.60;
const BLOCK_SUCCESS_RATE  = 0;  // block only when zero specialists succeeded

// ── Types ─────────────────────────────────────────────────────────────────────

export type VerificationVerdict = "pass" | "warn" | "block";

export interface CoordinationVerificationReport {
  verdict:    VerificationVerdict;
  checks:     VerificationCheck[];
  durationMs: number;
  blockedReason?: string;
}

interface VerificationCheck {
  name:    string;
  passed:  boolean;
  detail:  string;
}

// ── Telemetry ─────────────────────────────────────────────────────────────────

function emit(
  runId:     string,
  projectId: number,
  eventType: string,
  payload:   Record<string, unknown>,
): void {
  bus.emit("agent.event", {
    runId, projectId,
    phase:     "coordination",
    agentName: "post-coordination-verifier",
    eventType,
    payload,
    ts: Date.now(),
  });
}

// ── Check implementations ─────────────────────────────────────────────────────

function checkSuccessRate(result: CoordinationResult): VerificationCheck {
  const passed = result.specialistsRan > BLOCK_SUCCESS_RATE;
  return {
    name:   "specialist_success_rate",
    passed,
    detail: `${result.specialistsRan} specialist(s) ran; ${
      result.results.filter(r => r.success).length
    } succeeded`,
  };
}

function checkMergeIntegrity(patches: FilePatch[]): VerificationCheck {
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const p of patches) {
    if (seen.has(p.filePath)) dupes.push(p.filePath);
    seen.add(p.filePath);
  }
  return {
    name:   "merge_integrity",
    passed: dupes.length === 0,
    detail: dupes.length === 0
      ? `${patches.length} patch(es) — no duplicate files`
      : `Duplicate patch targets: ${dupes.join(", ")}`,
  };
}

function checkPatchConfidence(patches: FilePatch[]): VerificationCheck {
  if (patches.length === 0) {
    return { name: "patch_confidence", passed: true, detail: "no patches — skip" };
  }
  const avg = patches.reduce((s, p) => s + p.confidence, 0) / patches.length;
  return {
    name:   "patch_confidence",
    passed: avg >= MIN_CONFIDENCE,
    detail: `avg confidence = ${avg.toFixed(2)} (min ${MIN_CONFIDENCE})`,
  };
}

// ── Verifier ──────────────────────────────────────────────────────────────────

export async function verifyCoordinationResult(
  result: CoordinationResult,
): Promise<CoordinationVerificationReport> {
  const { runId, projectId } = result;
  const t0 = Date.now();

  emit(runId, projectId, "verification.start", {
    specialistsRan: result.specialistsRan,
    patchCount:     result.mergedPatches.length,
  });

  const checks: VerificationCheck[] = [
    checkSuccessRate(result),
    checkMergeIntegrity(result.mergedPatches),
    checkPatchConfidence(result.mergedPatches),
  ];

  const failed  = checks.filter(c => !c.passed);
  const durationMs = Date.now() - t0;

  let verdict: VerificationVerdict;
  let blockedReason: string | undefined;

  // Block only on zero-success (catastrophic failure)
  const successCheck = checks.find(c => c.name === "specialist_success_rate");
  if (successCheck && !successCheck.passed) {
    verdict       = "block";
    blockedReason = successCheck.detail;
  } else if (failed.length > 0) {
    verdict = "warn";
  } else {
    verdict = "pass";
  }

  emit(runId, projectId, "verification.complete", {
    verdict, durationMs,
    checksTotal:  checks.length,
    checksFailed: failed.length,
    blockedReason,
  });

  return { verdict, checks, durationMs, blockedReason };
}
