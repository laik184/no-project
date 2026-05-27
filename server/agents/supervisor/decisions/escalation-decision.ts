import type { OrchestrationPhase } from '../../../orchestration/events/event-types.ts';
import type { SupervisorDecision, EscalationReason, LoopRiskLevel } from '../types/supervisor.types.ts';

interface EscalationContext {
  phase: OrchestrationPhase;
  retryCount: number;
  loopRisk: LoopRiskLevel;
  error?: string;
  stuckMs?: number;
}

function resolveReason(ctx: EscalationContext): EscalationReason {
  if (ctx.loopRisk === 'critical' || ctx.loopRisk === 'high') return 'loop_detected';
  if (ctx.stuckMs && ctx.stuckMs > 120_000) return 'stuck_task';
  if (ctx.error) {
    const lower = ctx.error.toLowerCase();
    if (lower.includes('timeout') || lower.includes('timed out')) return 'timeout_exceeded';
  }
  return 'max_retries_exceeded';
}

const CRITICAL_PHASES: OrchestrationPhase[] = ['execution', 'verification'];

export const escalationDecision = {
  shouldEscalate(ctx: EscalationContext): SupervisorDecision {
    const reason = resolveReason(ctx);

    if (ctx.loopRisk === 'critical') {
      return {
        action:   'abort',
        reason:   `Critical loop risk detected in phase "${ctx.phase}" — aborting to prevent infinite execution`,
        metadata: { reason, loopRisk: ctx.loopRisk, phase: ctx.phase },
      };
    }

    if (ctx.loopRisk === 'high' && !CRITICAL_PHASES.includes(ctx.phase)) {
      return {
        action:   'skip',
        reason:   `High loop risk on non-critical phase "${ctx.phase}" — skipping`,
        metadata: { reason, loopRisk: ctx.loopRisk, phase: ctx.phase },
      };
    }

    return {
      action:   'escalate',
      reason:   `Escalating phase "${ctx.phase}" — ${reason}`,
      metadata: { reason, retryCount: ctx.retryCount, phase: ctx.phase, error: ctx.error },
    };
  },

  isCritical(ctx: EscalationContext): boolean {
    return ctx.loopRisk === 'critical' ||
      (ctx.stuckMs !== undefined && ctx.stuckMs > 300_000) ||
      CRITICAL_PHASES.includes(ctx.phase) && ctx.retryCount > 3;
  },

  getEscalationReason(ctx: EscalationContext): EscalationReason {
    return resolveReason(ctx);
  },
};
