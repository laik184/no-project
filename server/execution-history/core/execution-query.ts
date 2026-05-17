/**
 * server/execution-history/core/execution-query.ts
 *
 * Read-only query layer for tool execution history.
 * All DB reads go through here — no raw Drizzle calls in routes or hooks.
 */

import { db } from "../../infrastructure/db/index.ts";
import { toolExecutions } from "../schema/tool-executions.schema.ts";
import { eq, desc, and, gte, lte, inArray } from "drizzle-orm";
import type { ToolExecution } from "../schema/tool-executions.schema.ts";

export interface QueryExecutionsParams {
  runId?:      string;
  projectId?:  number;
  toolName?:   string;
  status?:     string;
  limit?:      number;
  offset?:     number;
  since?:      Date;
  until?:      Date;
}

/**
 * Fetch executions matching the given filters, newest first.
 */
export async function queryExecutions(
  params: QueryExecutionsParams,
): Promise<ToolExecution[]> {
  const conditions = [];

  if (params.runId)     conditions.push(eq(toolExecutions.runId, params.runId));
  if (params.projectId) conditions.push(eq(toolExecutions.projectId, params.projectId));
  if (params.toolName)  conditions.push(eq(toolExecutions.toolName, params.toolName));
  if (params.status)    conditions.push(eq(toolExecutions.status, params.status));
  if (params.since)     conditions.push(gte(toolExecutions.startedAt, params.since));
  if (params.until)     conditions.push(lte(toolExecutions.startedAt, params.until));

  const query = db
    .select()
    .from(toolExecutions)
    .orderBy(desc(toolExecutions.startedAt))
    .limit(params.limit ?? 100)
    .offset(params.offset ?? 0);

  return conditions.length > 0
    ? query.where(and(...conditions))
    : query;
}

/**
 * Fetch a single execution by its correlation ID.
 */
export async function getExecutionById(
  executionId: string,
): Promise<ToolExecution | null> {
  const rows = await db
    .select()
    .from(toolExecutions)
    .where(eq(toolExecutions.executionId, executionId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Fetch all executions for a run, ordered by stepIndex then startedAt (for timeline).
 */
export async function getRunTimeline(runId: string): Promise<ToolExecution[]> {
  return db
    .select()
    .from(toolExecutions)
    .where(eq(toolExecutions.runId, runId))
    .orderBy(toolExecutions.stepIndex, toolExecutions.startedAt);
}

/**
 * Count executions grouped by status for a given run.
 */
export async function getRunStatusCounts(
  runId: string,
): Promise<Record<string, number>> {
  const rows = await db
    .select()
    .from(toolExecutions)
    .where(eq(toolExecutions.runId, runId));

  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  return counts;
}

/**
 * Fetch executions for multiple runIds (batch lookup).
 */
export async function getExecutionsForRuns(
  runIds: string[],
): Promise<ToolExecution[]> {
  if (runIds.length === 0) return [];
  return db
    .select()
    .from(toolExecutions)
    .where(inArray(toolExecutions.runId, runIds))
    .orderBy(toolExecutions.startedAt);
}
