/**
 * server/quantum/verification/validators/graph-validator.ts
 *
 * Validates ExecutionGraph structural integrity before wave execution.
 * Fail-closed: throws ParallelValidationError on any graph inconsistency.
 */

import {
  ParallelValidationError, emitValidation,
  type ValidationResult, type ValidationCheck,
} from "./validator-helpers.ts";
import type { ExecutionGraph } from "../../../engine/graph/graph-types.ts";

/**
 * Validates that an ExecutionGraph has no structural integrity problems.
 * Checks: no orphan deps, valid state, no nodes stuck in "running".
 */
export function validateGraph(runId: string, graph: ExecutionGraph): ValidationResult {
  const t0     = Date.now();
  const checks: ValidationCheck[] = [];

  // Check 1: no orphan nodes (nodes with deps that don't exist in the graph)
  const nodeIds = new Set(graph.nodes.keys());
  const orphans: string[] = [];
  for (const [id, node] of graph.nodes) {
    for (const dep of (node as any).dependsOn ?? []) {
      if (!nodeIds.has(dep)) orphans.push(`${id}→${dep}`);
    }
  }
  checks.push({
    name:   "graph.no_orphan_deps",
    passed: orphans.length === 0,
    detail: orphans.length ? `Orphan dependencies: ${orphans.join(", ")}` : undefined,
  });

  // Check 2: graph must be in a valid execution state
  const validStates = new Set(["running", "validating"]);
  checks.push({
    name:   "graph.valid_state",
    passed: validStates.has(graph.status),
    detail: validStates.has(graph.status)
      ? undefined
      : `Graph status "${graph.status}" is not valid for execution`,
  });

  // Check 3: no nodes stuck in "running" state from a previous wave
  const stuckNodes = [...graph.nodes.values()].filter(n => n.status === "running");
  checks.push({
    name:   "graph.no_stuck_running",
    passed: stuckNodes.length === 0,
    detail: stuckNodes.length
      ? `Nodes stuck in "running": ${stuckNodes.map(n => n.id).join(", ")}`
      : undefined,
  });

  const allPassed = checks.every(c => c.passed);
  emitValidation(runId, "graph", allPassed, checks);

  if (!allPassed) {
    const failed = checks.filter(c => !c.passed).map(c => c.detail).join("; ");
    throw new ParallelValidationError("graph", "GRAPH_INCONSISTENT", failed);
  }

  return { passed: true, category: "graph", checks, durationMs: Date.now() - t0 };
}
