/**
 * collapse-engine.ts
 *
 * The "superposition collapse" layer.
 * Converts N parallel agent outputs into ONE deterministic final execution state.
 *
 * Contract:
 *   - MUST only be called after aggregation-validator returns valid=true
 *   - Produces CollapsedExecutionState or throws if unsafe
 *   - Emits telemetry for every phase transition
 */

import type {
  AgentResult, MergedFileState, MergeConflict, CollapsedExecutionState,
} from "./aggregation-types.ts";
import {
  emitCollapseCompleted, emitCollapseFailed,
} from "./aggregation-telemetry.ts";
import { recordSpanStart } from "../../orchestration/telemetry/metrics.ts";

// ── Public API ─────────────────────────────────────────────────────────────────

export interface CollapseInput {
  runId:       string;
  projectId:   number;
  waveIndex:   number;
  results:     AgentResult[];
  mergedFiles: MergedFileState[];
  conflicts:   MergeConflict[];
  startedAt:   number;
}

/**
 * Collapse all parallel agent outputs into one final execution state.
 * Throws `CollapseError` if the state would be unsafe to complete.
 */
export function collapse(input: CollapseInput): CollapsedExecutionState {
  const {
    runId, projectId, waveIndex,
    results, mergedFiles, conflicts, startedAt,
  } = input;

  const spanId = recordSpanStart(runId, `collapse:wave-${waveIndex}`, { projectId, waveIndex });

  try {
    const unresolved = conflicts.filter(c => !c.resolved).length;
    if (unresolved > 0) {
      const msg = `${unresolved} unresolved conflict(s) — collapse blocked`;
      emitCollapseFailed(runId, projectId, waveIndex, msg);
      throw new CollapseError(msg, "unresolved_conflicts");
    }

    const successful  = results.filter(r => r.success);
    const failed      = results.filter(r => !r.success);
    const winner      = _pickWinnerNode(successful);

    if (!winner && results.length > 0) {
      const msg = "No successful node result available — collapse blocked";
      emitCollapseFailed(runId, projectId, waveIndex, msg);
      throw new CollapseError(msg, "no_successful_result");
    }

    const overallConfidence = _computeOverallConfidence(successful);
    const verificationPassed = successful.some(r => r.verificationPassed);

    const state: CollapsedExecutionState = {
      runId,
      projectId,
      waveIndex,
      winnerNodeId:       winner?.nodeId ?? "",
      mergedFiles,
      totalNodes:         results.length,
      successfulNodes:    successful.length,
      failedNodes:        failed.length,
      conflicts:          conflicts.length,
      resolvedConflicts:  conflicts.filter(c => c.resolved).length,
      unresolvedConflicts: unresolved,
      overallConfidence,
      verificationPassed,
      collapsedAt:        Date.now(),
      durationMs:         Date.now() - startedAt,
      safe:               true,
    };

    emitCollapseCompleted(state, spanId);
    return state;

  } catch (err) {
    if (!(err instanceof CollapseError)) {
      emitCollapseFailed(runId, projectId, waveIndex, String(err));
    }
    throw err;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Deterministic winner selection:
 *   1. verificationPassed
 *   2. highest confidence
 *   3. lowest retries
 *   4. earliest completedAt
 */
function _pickWinnerNode(results: AgentResult[]): AgentResult | undefined {
  if (results.length === 0) return undefined;
  return [...results].sort((a, b) => {
    if (a.verificationPassed !== b.verificationPassed) return a.verificationPassed ? -1 : 1;
    if (a.confidence !== b.confidence) return b.confidence - a.confidence;
    if (a.retries !== b.retries) return a.retries - b.retries;
    return a.completedAt - b.completedAt;
  })[0];
}

function _computeOverallConfidence(results: AgentResult[]): number {
  if (results.length === 0) return 0;
  const sum = results.reduce((acc, r) => acc + r.confidence, 0);
  return sum / results.length;
}

// ── CollapseError ─────────────────────────────────────────────────────────────

export type CollapseFailReason =
  | "unresolved_conflicts"
  | "no_successful_result"
  | "invalid_state";

export class CollapseError extends Error {
  constructor(
    message:       string,
    public reason: CollapseFailReason,
  ) {
    super(message);
    this.name = "CollapseError";
  }
}
