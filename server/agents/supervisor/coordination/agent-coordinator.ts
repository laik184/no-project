/**
 * server/agents/supervisor/coordination/agent-coordinator.ts
 *
 * Coordinates downstream agents by mapping agent domains to
 * the correct dispatch calls. ALL calls go through dispatcher-client —
 * no direct execution, no agent instantiation, no business logic.
 */

import {
  executeTool,
  type SupervisorDispatchOptions,
} from './dispatcher-client.ts';
import type { ToolExecutionContext, ToolExecutionResult } from '../../../tools/registry/tool-types.ts';
import type { AgentDomain } from '../types/supervisor.types.ts';

// ── Agent routing tool name constants ─────────────────────────────────────────

export const AGENT_ROUTE_TOOLS = {
  ROUTE_PLAN:         'route_to_planner',
  ROUTE_EXECUTE:      'route_to_executor',
  ROUTE_VERIFY:       'route_to_verifier',
  ROUTE_BROWSE:       'route_to_browser',
  ROUTE_FILESYSTEM:   'route_to_filesystem',
  ROUTE_TERMINAL:     'route_to_terminal',
  SUPERVISION_STATUS: 'supervision_status_check',
  SUPERVISION_CANCEL: 'supervision_cancel_run',
} as const;

// ── Generic agent dispatch ─────────────────────────────────────────────────────

export async function coordinateAgent<TOutput = unknown>(
  _domain:  AgentDomain,
  toolName: string,
  input:    Record<string, unknown>,
  context:  ToolExecutionContext,
  opts?:    SupervisorDispatchOptions,
): Promise<ToolExecutionResult<TOutput>> {
  return executeTool<TOutput>(toolName, input, context, opts);
}

// ── Domain-specific coordinators ──────────────────────────────────────────────

export async function coordinatePlanning(
  goal:       string,
  projectId:  string,
  context:    ToolExecutionContext,
  opts?:      SupervisorDispatchOptions,
): Promise<ToolExecutionResult> {
  return coordinateAgent(
    'planner',
    AGENT_ROUTE_TOOLS.ROUTE_PLAN,
    { goal, projectId, sandboxRoot: context.sandboxRoot },
    context,
    { timeoutMs: 60_000, label: `route_to_planner(${goal.slice(0, 40)})`, ...opts },
  );
}

export async function coordinateExecution(
  taskId:  string,
  payload: Record<string, unknown>,
  context: ToolExecutionContext,
  opts?:   SupervisorDispatchOptions,
): Promise<ToolExecutionResult> {
  return coordinateAgent(
    'executor',
    AGENT_ROUTE_TOOLS.ROUTE_EXECUTE,
    { taskId, projectId: context.projectId, sandboxRoot: context.sandboxRoot, ...payload },
    context,
    { timeoutMs: 120_000, label: `route_to_executor(${taskId})`, ...opts },
  );
}

export async function coordinateVerification(
  taskId:  string,
  payload: Record<string, unknown>,
  context: ToolExecutionContext,
  opts?:   SupervisorDispatchOptions,
): Promise<ToolExecutionResult> {
  return coordinateAgent(
    'verifier',
    AGENT_ROUTE_TOOLS.ROUTE_VERIFY,
    { taskId, projectId: context.projectId, sandboxRoot: context.sandboxRoot, ...payload },
    context,
    { timeoutMs: 90_000, label: `route_to_verifier(${taskId})`, ...opts },
  );
}

export async function coordinateBrowser(
  taskId:  string,
  payload: Record<string, unknown>,
  context: ToolExecutionContext,
  opts?:   SupervisorDispatchOptions,
): Promise<ToolExecutionResult> {
  return coordinateAgent(
    'browser',
    AGENT_ROUTE_TOOLS.ROUTE_BROWSE,
    { taskId, projectId: context.projectId, sandboxRoot: context.sandboxRoot, ...payload },
    context,
    { timeoutMs: 60_000, label: `route_to_browser(${taskId})`, ...opts },
  );
}

export async function coordinateFilesystem(
  taskId:  string,
  payload: Record<string, unknown>,
  context: ToolExecutionContext,
  opts?:   SupervisorDispatchOptions,
): Promise<ToolExecutionResult> {
  return coordinateAgent(
    'filesystem',
    AGENT_ROUTE_TOOLS.ROUTE_FILESYSTEM,
    { taskId, projectId: context.projectId, sandboxRoot: context.sandboxRoot, ...payload },
    context,
    { timeoutMs: 30_000, label: `route_to_filesystem(${taskId})`, ...opts },
  );
}

export async function coordinateTerminal(
  taskId:  string,
  payload: Record<string, unknown>,
  context: ToolExecutionContext,
  opts?:   SupervisorDispatchOptions,
): Promise<ToolExecutionResult> {
  return coordinateAgent(
    'terminal',
    AGENT_ROUTE_TOOLS.ROUTE_TERMINAL,
    { taskId, projectId: context.projectId, sandboxRoot: context.sandboxRoot, ...payload },
    context,
    { timeoutMs: 120_000, label: `route_to_terminal(${taskId})`, ...opts },
  );
}
