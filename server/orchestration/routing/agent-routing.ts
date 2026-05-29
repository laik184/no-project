/**
 * server/orchestration/routing/agent-routing.ts
 *
 * Routes agent assignments dynamically based on phase requirements and
 * orchestration context. Pure routing logic — no dispatch, no execution.
 */

import type { AgentType, Phase } from '../types/orchestration.types.ts';

// ── Agent capability map ───────────────────────────────────────────────────────

interface AgentCapabilities {
  canPlan:     boolean;
  canExecute:  boolean;
  canVerify:   boolean;
  canBrowse:   boolean;
  canSupervise: boolean;
}

const AGENT_CAPABILITIES: Record<AgentType, AgentCapabilities> = {
  planner:    { canPlan: true,  canExecute: false, canVerify: false, canBrowse: false, canSupervise: false },
  executor:   { canPlan: false, canExecute: true,  canVerify: false, canBrowse: false, canSupervise: false },
  verifier:   { canPlan: false, canExecute: false, canVerify: true,  canBrowse: false, canSupervise: false },
  browser:    { canPlan: false, canExecute: false, canVerify: false, canBrowse: true,  canSupervise: false },
  filesystem: { canPlan: false, canExecute: true,  canVerify: false, canBrowse: false, canSupervise: false },
  terminal:   { canPlan: false, canExecute: true,  canVerify: false, canBrowse: false, canSupervise: false },
  supervisor: { canPlan: true,  canExecute: false, canVerify: true,  canBrowse: false, canSupervise: true  },
  coderx:     { canPlan: true,  canExecute: true,  canVerify: false, canBrowse: false, canSupervise: false },
};

// ── Routing result ────────────────────────────────────────────────────────────

export interface AgentRoutingDecision {
  agentType:   AgentType;
  reason:      string;
  fallback?:   AgentType;
}

// ── Route resolver ────────────────────────────────────────────────────────────

export function resolveAgentForPhase(phase: Phase): AgentRoutingDecision {
  const requested = phase.agentType;

  // Validate the requested agent can handle this phase name
  const capabilities = AGENT_CAPABILITIES[requested];
  if (!capabilities) {
    return {
      agentType: 'supervisor',
      reason:    `Unknown agent type "${requested}" — falling back to supervisor`,
      fallback:  'supervisor',
    };
  }

  return {
    agentType: requested,
    reason:    `Direct route to agent:${requested} for phase "${phase.name}"`,
  };
}

export function resolveFallbackAgent(primary: AgentType): AgentType {
  const fallbackMap: Partial<Record<AgentType, AgentType>> = {
    browser:    'executor',
    filesystem: 'executor',
    terminal:   'executor',
    planner:    'supervisor',
    verifier:   'supervisor',
  };
  return fallbackMap[primary] ?? 'supervisor';
}

export function agentSupports(agentType: AgentType, capability: keyof AgentCapabilities): boolean {
  return AGENT_CAPABILITIES[agentType]?.[capability] ?? false;
}

export function listCapableAgents(capability: keyof AgentCapabilities): AgentType[] {
  return (Object.keys(AGENT_CAPABILITIES) as AgentType[]).filter(
    a => AGENT_CAPABILITIES[a][capability],
  );
}
