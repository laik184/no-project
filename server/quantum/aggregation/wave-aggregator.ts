/**
 * wave-aggregator.ts
 *
 * Top-level orchestrator for the full wave aggregation pipeline:
 *
 *   collect → detect conflicts → merge → validate → collapse
 *
 * Called once per wave after runParallelBatch completes.
 * Fail-closed: any unresolvable conflict or validation failure blocks the wave.
 */

import type { ExecutionNode, ExecutionGraph } from "../../engine/graph/graph-types.ts";
import type { AgentResult, FileMutation, CollapsedExecutionState } from "./aggregation-types.ts";
import { openSession }          from "./state/aggregation-store.ts";
import { addResult, setStatus, setCollapsedState, hasUnresolvedConflicts } from "./state/aggregation-session.ts";
import { detectAllConflicts }   from "./conflict-detector.ts";
import { runMergeEngine }       from "./merge-engine.ts";
import { validateMergedState }  from "./aggregation-validator.ts";
import { collapse, CollapseError } from "./collapse-engine.ts";
import {
  emitAggregationStarted,
  emitAggregationCompleted,
  emitAggregationFailed,
} from "./aggregation-telemetry.ts";

// ── Public input contract ─────────────────────────────────────────────────────

export interface WaveAggregatorInput {
  runId:      string;
  projectId:  number;
  waveIndex:  number;
  nodes:      ExecutionNode[];
  graph:      ExecutionGraph;
}

// ── Main pipeline ─────────────────────────────────────────────────────────────

export const WaveAggregator = {
  /**
   * Run the full aggregation pipeline for one completed wave.
   * Returns the collapsed state. Throws on fail-closed violations.
   */
  async run(input: WaveAggregatorInput): Promise<CollapsedExecutionState> {
    const { runId, projectId, waveIndex, nodes, graph } = input;
    const startedAt = Date.now();

    // 1. Open session + emit started telemetry
    const session = openSession(runId, projectId, waveIndex);
    const spanId  = emitAggregationStarted(runId, projectId, waveIndex, nodes.length);
    session.spanId = spanId;
    setStatus(session, "collecting");

    try {
      // 2. Collect agent results from completed nodes
      const results = _collectResults(nodes, graph);
      for (const r of results) addResult(session, r);

      // 3. Detect conflicts
      setStatus(session, "merging");
      const detection = detectAllConflicts(results, runId, waveIndex, session.createdAt);
      for (const c of detection.conflicts) {
        // Mark all detected conflicts in session
        session.conflicts.push(c);
      }

      // Mark same-file-write conflicts as auto-resolved (merge engine will pick winner)
      for (const c of session.conflicts) {
        if (c.kind === "same_file_write" || c.kind === "duplicate_execution") {
          c.resolved = true;
          c.resolution = {
            strategy:   "precedence",
            winnerId:   "(merge-engine)",
            reason:     "Auto-resolved by merge engine via precedence strategy",
            resolvedAt: Date.now(),
          };
        }
      }

      // Fail-closed: stale writes and ownership conflicts are not auto-resolved
      if (hasUnresolvedConflicts(session)) {
        const msg = `Unresolved conflicts block wave ${waveIndex} — fail-closed`;
        setStatus(session, "blocked");
        emitAggregationFailed(runId, projectId, waveIndex, spanId, msg);
        throw new Error(msg);
      }

      // 4. Run merge engine
      const mergeResult = await runMergeEngine(results, runId);

      // 5. Validate merged state
      setStatus(session, "validating");
      const validation = validateMergedState(
        results, mergeResult.mergedFiles, session.conflicts, runId, projectId,
      );

      if (!validation.valid) {
        const msg = `Validation failed: ${validation.blockedReason}`;
        setStatus(session, "blocked");
        emitAggregationFailed(runId, projectId, waveIndex, spanId, msg);
        throw new Error(msg);
      }

      // 6. Collapse to final state
      const collapsedState = collapse({
        runId, projectId, waveIndex,
        results,
        mergedFiles: mergeResult.mergedFiles,
        conflicts:   session.conflicts,
        startedAt,
      });

      setCollapsedState(session, collapsedState);
      emitAggregationCompleted(runId, projectId, waveIndex, spanId, collapsedState.durationMs, nodes.length);

      return collapsedState;

    } catch (err) {
      if (session.status !== "blocked" && session.status !== "collapsed") {
        setStatus(session, "failed");
        const msg = err instanceof Error ? err.message : String(err);
        if (!(err instanceof CollapseError)) {
          emitAggregationFailed(runId, projectId, waveIndex, spanId, msg);
        }
      }
      throw err;
    }
  },
};

// ── Result collector ──────────────────────────────────────────────────────────

function _collectResults(nodes: ExecutionNode[], graph: ExecutionGraph): AgentResult[] {
  const results: AgentResult[] = [];

  for (const node of nodes) {
    if (node.status !== "success" && node.status !== "failed") continue;

    const mutations = _extractFileMutations(node);

    results.push({
      nodeId:             node.id,
      agentId:            node.agentRole ?? node.toolName ?? node.id,
      waveIndex:          0,   // filled by caller context
      runId:              graph.id,
      projectId:          graph.projectId,
      success:            node.status === "success",
      output:             node.result,
      fileMutations:      mutations,
      toolResults:        [],
      runtimeEvidence:    null,
      verificationPassed: node.type === "verify" && node.status === "success",
      confidence:         _inferConfidence(node),
      durationMs:         node.durationMs ?? 0,
      retries:            node.retryCount,
      completedAt:        node.completedAt ?? Date.now(),
      error:              node.error,
    });
  }

  return results;
}

function _extractFileMutations(node: ExecutionNode): FileMutation[] {
  if (!node.result) return [];

  const raw = node.result as Record<string, unknown>;
  const mutations: FileMutation[] = [];
  const ts = node.completedAt ?? Date.now();

  // Tool results often carry { path, content } or { filePath, content }
  const filePath = (raw.path ?? raw.filePath) as string | undefined;
  const content  = raw.content as string | undefined;

  if (filePath && content) {
    mutations.push({
      filePath,
      operation: "write",
      content,
      ownerId: node.id,
      ts,
    });
  }

  // Array-form: [{ path, content }, ...]
  if (Array.isArray(raw.files)) {
    for (const f of raw.files as Array<{ path?: string; filePath?: string; content?: string }>) {
      const fp = f.path ?? f.filePath;
      if (fp && f.content) {
        mutations.push({ filePath: fp, operation: "write", content: f.content, ownerId: node.id, ts });
      }
    }
  }

  return mutations;
}

function _inferConfidence(node: ExecutionNode): number {
  if (node.status === "failed")  return 0;
  if (node.type === "verify")    return node.status === "success" ? 1.0 : 0.1;
  if (node.retryCount === 0)     return 0.85;
  return Math.max(0.1, 0.85 - node.retryCount * 0.15);
}
