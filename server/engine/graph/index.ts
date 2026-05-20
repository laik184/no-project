/**
 * server/engine/graph/index.ts
 *
 * Public API for the DAG execution engine.
 */

export { runGraph, replayFromCheckpoint }     from "./graph-engine.ts";
export {
  createGraph, addNode, addEdge, setNodeStatus,
  setGraphStatus, validateGraph, isGraphComplete,
  hasCriticalFailure, getAllNodes, getNodesByStatus,
  graphSummary,
}                                             from "./execution-graph.ts";
export { getReadyNodes, getBlockedNodes, criticalPathLength, findParallelSets } from "./dependency-resolver.ts";
export { buildSchedule, getNextWave, describeSchedule, createSchedulerEvents }  from "./node-scheduler.ts";
export { createCheckpoint, restoreCheckpoint, prepareReplay, serializeGraph }   from "./graph-state.ts";
export { buildRollbackPlan, executeRollback, skipBlockedNodes }                 from "./rollback-graph.ts";
export { runParallelBatch, aggregateResults }                                   from "./parallel-runner.ts";

export type {
  ExecutionGraph,
  ExecutionNode,
  ExecutionEdge,
  GraphResult,
  GraphStatus,
  NodeStatus,
  NodeType,
  RetryStrategy,
  GraphValidationResult,
}                                             from "./graph-types.ts";
export type { NodeExecutor }                  from "./parallel-runner.ts";
export type { RollbackExecutor }              from "./rollback-graph.ts";
export type { SchedulerWave, SchedulerEvents }from "./node-scheduler.ts";
