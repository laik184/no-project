/**
 * path-verifier.ts
 *
 * Runs lightweight verification checks on a single execution path result.
 * Does NOT call the full fail-closed pipeline — that runs at collapse time.
 * Purpose: early disqualification of obviously broken paths.
 */

import type { PathResult } from "../types/path.types.ts";
import { incrementCounter } from "../../orchestration/telemetry/orchestration-metrics.ts";

// ── Verification result ───────────────────────────────────────────────────────

export interface PathVerificationResult {
  pathId:        string;
  passed:        boolean;
  checks:        PathCheck[];
  failureReason: string | null;
}

export interface PathCheck {
  name:    string;
  passed:  boolean;
  detail:  string;
}

// ── Verifier ──────────────────────────────────────────────────────────────────

export function verifyPath(result: PathResult): PathVerificationResult {
  const checks: PathCheck[] = [];

  // Check 1: execution succeeded
  checks.push({
    name:   "execution_success",
    passed: result.success,
    detail: result.success ? "OK" : `Failed: ${result.error ?? "unknown"}`,
  });

  // Check 2: verification gate passed
  checks.push({
    name:   "verification_gate",
    passed: result.verificationPassed,
    detail: result.verificationPassed ? "Verification passed" : "Verification did not pass",
  });

  // Check 3: files were actually written
  checks.push({
    name:   "files_written",
    passed: result.filesWritten.length > 0,
    detail: `${result.filesWritten.length} file(s) written`,
  });

  // Check 4: retry count within acceptable range (< 4 retries = healthy)
  checks.push({
    name:   "retry_budget",
    passed: result.retries < 4,
    detail: `${result.retries} retries used`,
  });

  // Check 5: duration within bounds (< 10 minutes)
  const MAX_DURATION = 10 * 60 * 1_000;
  checks.push({
    name:   "duration_bounds",
    passed: result.durationMs < MAX_DURATION,
    detail: `Completed in ${Math.round(result.durationMs / 1000)}s`,
  });

  const passed    = checks.every(c => c.passed);
  const firstFail = checks.find(c => !c.passed);

  incrementCounter("quantum.path.verification", {
    pathId: result.pathId.slice(-8),
    passed: String(passed),
  });

  return {
    pathId:        result.pathId,
    passed,
    checks,
    failureReason: firstFail ? `${firstFail.name}: ${firstFail.detail}` : null,
  };
}

// ── Batch verification ────────────────────────────────────────────────────────

export function verifyAllPaths(
  results: Map<string, PathResult>,
): Map<string, PathVerificationResult> {
  const out = new Map<string, PathVerificationResult>();
  for (const [pathId, result] of results) {
    out.set(pathId, verifyPath(result));
  }
  return out;
}

export function filterVerifiedPaths(
  results: Map<string, PathResult>,
): string[] {
  const verified = verifyAllPaths(results);
  return Array.from(verified.entries())
    .filter(([, r]) => r.passed)
    .map(([pathId]) => pathId);
}
