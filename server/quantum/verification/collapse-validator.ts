/**
 * collapse-validator.ts
 *
 * Pre-collapse validation gate. MUST pass before a quantum run can collapse.
 * Enforces fail-closed invariants:
 *   - at least one verified path exists
 *   - no unresolved conflicts remain
 *   - winner path passed verification
 *   - evidence is present
 *
 * INVARIANT: collapse NEVER proceeds if any gate fails.
 */

import type { CollapsedState }  from "../types/quantum.types.ts";
import type { AggregatedResult } from "../types/quantum.types.ts";
import { hasUnresolved }         from "../conflicts/file-conflict-detector.ts";
import { incrementCounter }      from "../../orchestration/telemetry/orchestration-metrics.ts";

// ── Validation result ─────────────────────────────────────────────────────────

export interface CollapseValidationResult {
  allowed:       boolean;
  gates:         CollapseGate[];
  blockingGates: string[];
}

export interface CollapseGate {
  name:   string;
  passed: boolean;
  detail: string;
}

// ── Validator ─────────────────────────────────────────────────────────────────

export function validateBeforeCollapse(
  aggregated:    AggregatedResult,
  collapsed:     CollapsedState,
): CollapseValidationResult {
  const gates: CollapseGate[] = [];

  // Gate 1: at least one completed path
  gates.push({
    name:   "min_completed_paths",
    passed: aggregated.completedPaths.length > 0,
    detail: `${aggregated.completedPaths.length} path(s) completed successfully`,
  });

  // Gate 2: winner path is from completed set
  gates.push({
    name:   "winner_in_completed",
    passed: aggregated.completedPaths.includes(collapsed.winnerPathId),
    detail: `Winner ${collapsed.winnerPathId} is ${
      aggregated.completedPaths.includes(collapsed.winnerPathId) ? "" : "NOT "}in completed set`,
  });

  // Gate 3: no unresolved conflicts
  gates.push({
    name:   "no_unresolved_conflicts",
    passed: !hasUnresolved(aggregated.quantumRunId),
    detail: hasUnresolved(aggregated.quantumRunId)
      ? "Unresolved file conflicts remain — cannot collapse"
      : "All conflicts resolved",
  });

  // Gate 4: winner passed verification
  gates.push({
    name:   "winner_verification_passed",
    passed: collapsed.verificationPassed,
    detail: collapsed.verificationPassed
      ? "Winner path passed verification"
      : "Winner path did NOT pass verification",
  });

  // Gate 5: files were actually written
  gates.push({
    name:   "files_present",
    passed: collapsed.filesWritten.length > 0,
    detail: `${collapsed.filesWritten.length} file(s) in final state`,
  });

  // Gate 6: confidence above floor (0.20)
  gates.push({
    name:   "confidence_floor",
    passed: collapsed.confidenceScore >= 0.20,
    detail: `Winner confidence=${collapsed.confidenceScore.toFixed(3)} (floor=0.20)`,
  });

  const blockingGates = gates.filter(g => !g.passed).map(g => g.name);
  const allowed       = blockingGates.length === 0;

  incrementCounter("quantum.collapse.validation", {
    allowed: String(allowed),
    blocked: String(blockingGates.length),
  });

  if (!allowed) {
    console.error(
      `[collapse-validator] BLOCKED quantumRunId=${aggregated.quantumRunId} ` +
      `gates=${blockingGates.join(",")}`,
    );
  }

  return { allowed, gates, blockingGates };
}
