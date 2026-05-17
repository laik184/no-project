/**
 * server/execution-history/index.ts
 *
 * Public entry point for the Tool Execution History system.
 *
 * Initialisation (call once at startup, after DB is ready):
 *   import { initExecutionHistory } from "./server/execution-history/index.ts";
 *   initExecutionHistory();
 *
 * Router mounting:
 *   import { createExecutionHistoryRouter } from "./server/execution-history/index.ts";
 *   app.use("/api/execution-history", createExecutionHistoryRouter());
 */

export { createExecutionHistoryRouter }        from "./api/execution-history.routes.ts";
export { attachToolExecutionHook, detachToolExecutionHook } from "./hooks/tool-lifecycle-hook.ts";
export { buildTimeline, formatTimelineSummary }  from "./timeline/timeline-builder.ts";
export { computeToolMetrics, computeRunMetrics, computeGlobalMetrics } from "./metrics/metrics-collector.ts";
export { buildReplayEnvelope }                 from "./replay/replay-serializer.ts";
export { queryExecutions, getExecutionById, getRunTimeline } from "./core/execution-query.ts";
export { toolExecutions }                      from "./schema/tool-executions.schema.ts";
export type { ToolExecution, InsertToolExecution } from "./schema/tool-executions.schema.ts";

import { attachToolExecutionHook }             from "./hooks/tool-lifecycle-hook.ts";

/**
 * Bootstrap the execution history system.
 * Attaches the bus hook that persists tool lifecycle events.
 * Call once at server startup, after the event bus is ready.
 */
export function initExecutionHistory(): void {
  attachToolExecutionHook();
  console.log("[exec-history] Tool execution history system initialized.");
}
