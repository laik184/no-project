/**
 * server/orchestration/coordination/agent-coordinator.ts
 *
 * Coordinates downstream agents by routing execution flow through
 * the dispatcher-client. Manages agent lifecycle at orchestration scope.
 * Orchestration-only — no direct tool calls, no filesystem access.
 */

import { routeCommand } from './dispatcher-client.ts';
import type { ToolExecutionResult, ToolExecutionContext } from './dispatcher-client.ts';
import type { AgentType, Phase, PhaseResult } from '../types/orchestration.types.ts';
import { now } from '../utils/orchestration-utils.ts';

// ── Agent → tool name mapping ─────────────────────────────────────────────────

const AGENT_TOOL_MAP: Record<AgentType, string> = {
  planner:    'orchestrate_plan',
  executor:   'orchestrate_execute',
  verifier:   'orchestrate_verify',
  browser:    'orchestrate_browse',
  filesystem: 'orchestrate_fs',
  terminal:   'orchestrate_terminal',
  supervisor: 'orchestrate_supervise',
};

function toolNameForAgent(agentType: AgentType): string {
  return AGENT_TOOL_MAP[agentType] ?? `orchestrate_${agentType}`;
}

// ── Phase dispatch ────────────────────────────────────────────────────────────

/**
 * Dispatches a single phase to its designated agent via the dispatcher.
 * Returns a PhaseResult — never throws.
 */
export async function dispatchPhaseToAgent(
  phase:   Phase,
  context: ToolExecutionContext,
  attempt: number,
): Promise<PhaseResult> {
  const start    = Date.now();
  const toolName = toolNameForAgent(phase.agentType);

  const result: ToolExecutionResult<unknown> = await routeCommand(
    toolName,
    { ...phase.input, phaseId: phase.phaseId, phaseName: phase.name },
    context,
  );

  const durationMs = Date.now() - start;

  if (result.ok) {
    return {
      phaseId:   phase.phaseId,
      agentType: phase.agentType,
      ok:        true,
      output:    result.data,
      durationMs,
      attempts:  attempt,
    };
  }

  return {
    phaseId:   phase.phaseId,
    agentType: phase.agentType,
    ok:        false,
    error:     result.error,
    durationMs,
    attempts:  attempt,
  };
}

// ── Readiness probe ───────────────────────────────────────────────────────────

/**
 * Checks if an agent type is reachable by sending a lightweight ping
 * through the dispatcher. Returns true if the agent responds OK.
 */
export async function probeAgent(
  agentType: AgentType,
  context:   ToolExecutionContext,
): Promise<boolean> {
  const toolName = toolNameForAgent(agentType);
  const result   = await routeCommand(
    toolName,
    { probe: true, timestamp: now().toISOString() },
    context,
    { timeoutMs: 5_000 },
  );
  return result.ok;
}

// ── Agent type helpers ────────────────────────────────────────────────────────

export function isValidAgentType(value: string): value is AgentType {
  return Object.keys(AGENT_TOOL_MAP).includes(value);
}

export function allAgentTypes(): AgentType[] {
  return Object.keys(AGENT_TOOL_MAP) as AgentType[];
}
