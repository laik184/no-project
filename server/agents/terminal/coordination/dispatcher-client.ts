/**
 * server/agents/terminal/coordination/dispatcher-client.ts
 *
 * THE only gateway from the terminal agent to the tool execution layer.
 * All tool invocations MUST flow through this client.
 * No direct shell execution, no child_process, no execa.
 */

import { dispatch }               from '../../../tools/registry/tool-dispatcher.ts';
import type { ToolExecutionContext, ToolExecutionResult } from '../../../tools/registry/tool-types.ts';
import type { DispatchRequest, DispatchResponse } from '../types/terminal.types.ts';
import { terminalLogger }         from '../telemetry/terminal-logger.ts';
import { terminalMetrics }        from '../telemetry/terminal-metrics.ts';

const SYSTEM_RUN_ID     = 'system';
const SYSTEM_PROJECT_ID = 'system';
const SYSTEM_SANDBOX    = process.env.AGENT_PROJECT_ROOT ?? '.sandbox';

/** Build a ToolExecutionContext from a dispatch request. */
function buildContext(req: DispatchRequest): ToolExecutionContext {
  return {
    runId:       req.runId,
    projectId:   req.projectId,
    sandboxRoot: req.sandboxRoot,
    meta:        {},
  };
}

/** Build a system-level context when no session context is available. */
function buildSystemContext(sandboxRoot?: string): ToolExecutionContext {
  return {
    runId:       SYSTEM_RUN_ID,
    projectId:   SYSTEM_PROJECT_ID,
    sandboxRoot: sandboxRoot ?? SYSTEM_SANDBOX,
    meta:        {},
  };
}

/**
 * Execute a tool by name through the centralized dispatcher.
 * Returns a typed DispatchResponse — never throws.
 */
export async function executeViaDispatcher<T = unknown>(
  req: DispatchRequest,
): Promise<DispatchResponse<T>> {
  const start   = Date.now();
  const context = buildContext(req);

  terminalLogger.debug(req.runId, `dispatch → ${req.toolName}`, { input: req.input });

  const result: ToolExecutionResult<T> = await dispatch<Record<string, unknown>, T>(
    req.toolName,
    req.input,
    context,
    req.timeoutMs ? { timeoutMs: req.timeoutMs } : {},
  );

  const durationMs = Date.now() - start;
  terminalMetrics.recordStep(req.runId, result.ok, durationMs);

  if (result.ok) {
    terminalLogger.debug(req.runId, `dispatch ✓ ${req.toolName}`, { durationMs });
    return { ok: true, data: result.data, durationMs };
  }

  terminalLogger.warn(req.runId, `dispatch ✗ ${req.toolName}: ${result.error}`, { code: result.code, durationMs });
  return { ok: false, error: result.error, code: result.code, durationMs };
}

/**
 * Execute a tool using a system-level context (no session).
 * Used by agent wrappers that don't have a full session context.
 */
export async function executeSystem<T = unknown>(
  toolName:    string,
  input:       Record<string, unknown>,
  sandboxRoot?: string,
  timeoutMs?:  number,
): Promise<DispatchResponse<T>> {
  const start   = Date.now();
  const context = buildSystemContext(sandboxRoot);

  const result: ToolExecutionResult<T> = await dispatch<Record<string, unknown>, T>(
    toolName,
    input,
    context,
    timeoutMs ? { timeoutMs } : {},
  );

  const durationMs = Date.now() - start;

  if (result.ok) return { ok: true, data: result.data, durationMs };
  return { ok: false, error: result.error, code: result.code, durationMs };
}
