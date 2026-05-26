import type { OrchestrationPhase } from '../events/event-types.ts';
import { runLogger } from '../telemetry/run-logger.ts';

export type AgentName = 'planner' | 'executor' | 'verifier' | 'browser' | 'analyzer';

export interface AgentDescriptor {
  name: AgentName;
  phase: OrchestrationPhase;
  capabilities: string[];
}

export interface RoutingDecision {
  agent: AgentName;
  phase: OrchestrationPhase;
  reason: string;
}

const AGENT_REGISTRY: AgentDescriptor[] = [
  { name: 'analyzer', phase: 'analyze', capabilities: ['analyze', 'classify', 'detect'] },
  { name: 'planner',  phase: 'planning', capabilities: ['plan', 'design', 'structure'] },
  { name: 'executor', phase: 'execution', capabilities: ['execute', 'code', 'implement', 'write'] },
  { name: 'verifier', phase: 'verification', capabilities: ['verify', 'build', 'typecheck', 'lint'] },
  { name: 'browser',  phase: 'browser', capabilities: ['browser', 'screenshot', 'ui', 'visual'] },
];

const PHASE_TO_AGENT: Record<OrchestrationPhase, AgentName | null> = {
  analyze: 'analyzer',
  planning: 'planner',
  execution: 'executor',
  verification: 'verifier',
  browser: 'browser',
  complete: null,
  failed: null,
};

export const agentRouter = {
  resolveByPhase(runId: string, phase: OrchestrationPhase): RoutingDecision {
    const agent = PHASE_TO_AGENT[phase];
    if (!agent) {
      runLogger.log(runId, 'warn', `[agent-router] No agent for phase "${phase}" — using executor fallback`);
      return { agent: 'executor', phase, reason: 'Fallback: no dedicated agent for this phase' };
    }
    runLogger.log(runId, 'info', `[agent-router] Phase "${phase}" → agent "${agent}"`);
    return { agent, phase, reason: `Direct phase-to-agent mapping` };
  },

  resolveByCapability(runId: string, capability: string): RoutingDecision {
    const match = AGENT_REGISTRY.find((a) =>
      a.capabilities.some((c) => capability.toLowerCase().includes(c))
    );
    if (!match) {
      runLogger.log(runId, 'warn', `[agent-router] No capability match for "${capability}" — fallback to executor`);
      return { agent: 'executor', phase: 'execution', reason: `No capability match: ${capability}` };
    }
    runLogger.log(runId, 'info', `[agent-router] Capability "${capability}" → agent "${match.name}"`);
    return { agent: match.name, phase: match.phase, reason: `Capability match: ${capability}` };
  },

  validate(agent: unknown): agent is AgentName {
    return ['planner', 'executor', 'verifier', 'browser', 'analyzer'].includes(agent as string);
  },

  listAgents(): AgentDescriptor[] {
    return [...AGENT_REGISTRY];
  },

  getAgentForPhase(phase: OrchestrationPhase): AgentName | null {
    return PHASE_TO_AGENT[phase];
  },
};
