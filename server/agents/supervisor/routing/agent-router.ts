import type { OrchestrationPhase } from '../../../orchestration/events/event-types.ts';
import type { AgentRole, AgentDescriptor, RoutingDecision } from '../types/routing.types.ts';
import type { TaskPriority } from '../types/supervisor.types.ts';
import { AGENT_REGISTRY } from '../types/routing.types.ts';
import { generateTaskId } from '../utils/supervisor-helpers.ts';
import { supervisorLogger } from '../telemetry/supervisor-logger.ts';

const routingHistory = new Map<string, RoutingDecision[]>();

export const agentRouter = {
  route(runId: string, phase: OrchestrationPhase, priority: TaskPriority): RoutingDecision {
    const descriptor = AGENT_REGISTRY[phase];
    if (!descriptor) {
      throw new Error(`[agent-router] No agent registered for phase "${phase}"`);
    }

    const decision: RoutingDecision = {
      taskId:      generateTaskId(runId, phase),
      runId,
      targetAgent: descriptor.role,
      targetPhase: phase,
      priority,
      reason:      `Phase "${phase}" → agent "${descriptor.role}" (timeout=${descriptor.timeoutMs}ms)`,
      scheduledAt: new Date(),
    };

    this._record(runId, decision);
    supervisorLogger.info(runId, `[agent-router] ${decision.reason}`);

    return decision;
  },

  getDescriptor(phase: OrchestrationPhase): AgentDescriptor {
    const d = AGENT_REGISTRY[phase];
    if (!d) throw new Error(`[agent-router] No descriptor for phase "${phase}"`);
    return d;
  },

  isRetryable(phase: OrchestrationPhase): boolean {
    return AGENT_REGISTRY[phase]?.retryable ?? false;
  },

  timeoutFor(phase: OrchestrationPhase): number {
    return AGENT_REGISTRY[phase]?.timeoutMs ?? 30_000;
  },

  getHistory(runId: string): RoutingDecision[] {
    return routingHistory.get(runId) ?? [];
  },

  clearRun(runId: string): void {
    routingHistory.delete(runId);
  },

  _record(runId: string, decision: RoutingDecision): void {
    if (!routingHistory.has(runId)) routingHistory.set(runId, []);
    const hist = routingHistory.get(runId)!;
    hist.push(decision);
    if (hist.length > 50) hist.shift();
  },
};
