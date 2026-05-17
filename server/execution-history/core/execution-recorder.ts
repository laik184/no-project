/**
 * server/execution-history/core/execution-recorder.ts
 *
 * Writes tool execution records to the database.
 * Responsible for: opening a record on start, closing it on success/error.
 * Never mixes event routing with persistence — single responsibility.
 */

import { db } from "../../infrastructure/db/index.ts";
import { toolExecutions } from "../schema/tool-executions.schema.ts";
import { eq } from "drizzle-orm";
import { capJson } from "../replay/replay-serializer.ts";

const MAX_FIELD_BYTES = 10_240; // 10 KB cap per field

export interface OpenExecutionParams {
  executionId: string;
  runId:       string;
  projectId?:  number;
  stepIndex?:  number;
  toolName:    string;
  toolCategory?: string;
  args:        unknown;
  replaySafe?: boolean;
}

export interface CloseExecutionParams {
  executionId: string;
  status:      "success" | "error" | "timeout" | "aborted";
  result?:     unknown;
  error?:      string;
  durationMs:  number;
}

/**
 * Insert a new execution record in "running" state.
 * Returns the DB row id for fast lookup later.
 */
export async function openExecution(params: OpenExecutionParams): Promise<void> {
  const argsJson = capJson(params.args, MAX_FIELD_BYTES);

  await db.insert(toolExecutions).values({
    executionId:  params.executionId,
    runId:        params.runId,
    projectId:    params.projectId,
    stepIndex:    params.stepIndex,
    toolName:     params.toolName,
    toolCategory: params.toolCategory,
    status:       "running",
    argsJson:     argsJson as any,
    replaySafe:   params.replaySafe ?? true,
  }).onConflictDoNothing();
}

/**
 * Update an existing execution record to its terminal state.
 */
export async function closeExecution(params: CloseExecutionParams): Promise<void> {
  const resultJson = params.result !== undefined
    ? capJson(params.result, MAX_FIELD_BYTES)
    : undefined;

  await db.update(toolExecutions)
    .set({
      status:     params.status,
      resultJson: resultJson as any ?? null,
      errorText:  params.error ?? null,
      durationMs: params.durationMs,
      endedAt:    new Date(),
    })
    .where(eq(toolExecutions.executionId, params.executionId));
}

/**
 * Increment the retry counter for an execution that is being retried.
 */
export async function incrementRetry(executionId: string): Promise<void> {
  const rows = await db
    .select({ retryCount: toolExecutions.retryCount })
    .from(toolExecutions)
    .where(eq(toolExecutions.executionId, executionId))
    .limit(1);

  if (rows.length === 0) return;
  const next = (rows[0].retryCount ?? 0) + 1;

  await db.update(toolExecutions)
    .set({ retryCount: next })
    .where(eq(toolExecutions.executionId, executionId));
}
