/**
 * server/execution-history/schema/tool-executions.schema.ts
 *
 * Re-exports the canonical toolExecutions table from shared/schema.ts.
 * The table definition lives in shared/ so Drizzle-kit picks it up automatically.
 * This file provides a scoped import path for execution-history internals.
 */

export { toolExecutions } from "../../../shared/schema.ts";
export type { ToolExecutionRow as ToolExecution, InsertToolExecution } from "../../../shared/schema.ts";
