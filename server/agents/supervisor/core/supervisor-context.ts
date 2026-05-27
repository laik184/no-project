/**
 * supervisor-context.ts — Immutable execution context for a supervisor session.
 *
 * Stores: goal, mode, category, complexity, classification — set at creation, never mutated.
 * Mutable runtime metadata belongs in supervisor-state.ts.
 */

import type { OrchestrationContext } from '../../../orchestration/events/event-types.ts';
import type { ExecutionMode, GoalCategory, ComplexityResult, ClassificationResult } from '../types/supervisor.types.ts';

export interface SupervisorContext {
  readonly sessionId:      string;
  readonly runId:          string;
  readonly projectId:      string;
  readonly goal:           string;
  readonly timeoutMs:      number;
  readonly mode:           ExecutionMode;
  readonly category:       GoalCategory;
  readonly complexity:     ComplexityResult;
  readonly classification: ClassificationResult;
  readonly startedAt:      Date;
  readonly metadata:       Readonly<Record<string, unknown>>;
}

const contexts = new Map<string, SupervisorContext>();

export const supervisorContext = {
  create(
    sessionId: string,
    orchestrationCtx: OrchestrationContext,
    mode: ExecutionMode,
    category: GoalCategory,
    complexity: ComplexityResult,
    classification: ClassificationResult,
  ): SupervisorContext {
    const ctx: SupervisorContext = Object.freeze({
      sessionId,
      runId:          orchestrationCtx.runId,
      projectId:      orchestrationCtx.projectId,
      goal:           orchestrationCtx.goal,
      timeoutMs:      orchestrationCtx.timeoutMs,
      mode,
      category,
      complexity,
      classification,
      startedAt:      orchestrationCtx.startedAt,
      metadata:       Object.freeze({ ...orchestrationCtx.metadata }),
    });
    contexts.set(sessionId, ctx);
    return ctx;
  },

  get(sessionId: string): SupervisorContext | undefined {
    return contexts.get(sessionId);
  },

  getByRunId(runId: string): SupervisorContext | undefined {
    for (const c of contexts.values()) {
      if (c.runId === runId) return c;
    }
    return undefined;
  },

  toOrchestrationContext(sessionId: string): OrchestrationContext | undefined {
    const c = contexts.get(sessionId);
    if (!c) return undefined;
    return {
      runId:     c.runId,
      projectId: c.projectId,
      goal:      c.goal,
      startedAt: c.startedAt,
      timeoutMs: c.timeoutMs,
      metadata:  { ...c.metadata },
    };
  },

  clear(sessionId: string): void {
    contexts.delete(sessionId);
  },
};
