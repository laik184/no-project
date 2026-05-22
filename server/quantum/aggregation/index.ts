/**
 * server/quantum/aggregation/index.ts
 *
 * Public API for the DAG-Wave Result Aggregation Layer.
 *
 * Usage (from graph-engine.ts, after runParallelBatch):
 *
 *   import { WaveAggregator } from "../../quantum/aggregation/index.ts";
 *
 *   const collapsed = await WaveAggregator.run({
 *     runId, projectId, waveIndex, nodes: wave, graph,
 *   });
 *   if (!collapsed.safe) throw new Error("Unsafe collapse — blocking wave progression");
 */

export { WaveAggregator, type WaveAggregatorInput } from "./wave-aggregator.ts";
export type {
  AgentResult,
  FileMutation,
  ToolResult,
  RuntimeEvidence,
  MergeConflict,
  MergedFileState,
  CollapsedExecutionState,
  ValidationReport,
  MergeStrategyKind,
  ConflictKind,
  AggregationStatus,
} from "./aggregation-types.ts";
export { openSession, getSession, getRunSessions, clearRun, storeStats } from "./state/aggregation-store.ts";
export { CollapseError }     from "./collapse-engine.ts";
