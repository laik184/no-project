/**
 * server/engine/dag/index.ts
 * Public barrel for DAG telemetry + node builder.
 */

export {
  createDagBusEvents,
  emitNodeCreated,
  emitNodeReady,
  emitNodeStarted,
  emitNodeCompleted,
  emitNodeFailed,
  emitNodeRetry,
  emitNodeRollback,
  emitParallelStart,
  emitParallelComplete,
  emitExecutionCompleted,
} from "./dag-telemetry.ts";

export type { DagTelemetryContext } from "./dag-telemetry.ts";

export {
  buildGraphFromPlan,
  buildLinearGraph,
  buildParallelGraph,
} from "./dag-node-builder.ts";

export type { PlanTask, ExecutionPlanInput } from "./dag-node-builder.ts";
