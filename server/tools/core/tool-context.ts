/**
 * server/tools/core/tool-context.ts
 *
 * Factory for ToolExecutionContext used by the node executor
 * and any code that dispatches tools directly.
 */

import path from 'path';

export interface ToolContext {
  projectId:   string;
  runId:       string;
  sandboxRoot: string;
  signal?:     AbortSignal;
  meta:        Record<string, unknown>;
}

const SANDBOX_ROOT = process.env.AGENT_PROJECT_ROOT ?? '.sandbox';

/**
 * Build a ToolContext from projectId + runId.
 * Accepts number projectId (coerced to string for path safety).
 * Optional AbortSignal for cancellation support.
 */
export function createContext(
  projectId: string | number,
  runId:     string,
  signal?:   AbortSignal,
): ToolContext {
  const pid = String(projectId);
  return Object.freeze({
    projectId:   pid,
    runId,
    sandboxRoot: path.join(SANDBOX_ROOT, pid),
    signal,
    meta: {},
  });
}

/**
 * Build a system-level context (no project/run isolation).
 */
export function createSystemContext(overrides: Partial<ToolContext> = {}): ToolContext {
  return createContext(
    overrides.projectId ?? 'system',
    overrides.runId     ?? 'system',
    overrides.signal,
  );
}
