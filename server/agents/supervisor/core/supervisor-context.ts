import type { OrchestrationContext } from '../../../orchestration/events/event-types.ts';
import type { ExecutionMode, GoalCategory, ComplexityResult, ClassificationResult } from '../types/supervisor.types.ts';

export interface SupervisorContext {
  sessionId:      string;
  runId:          string;
  projectId:      string;
  goal:           string;
  timeoutMs:      number;
  mode:           ExecutionMode;
  category:       GoalCategory;
  complexity:     ComplexityResult;
  classification: ClassificationResult;
  startedAt:      Date;
  metadata:       Record<string, unknown>;
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
    const ctx: SupervisorContext = {
      sessionId,
      runId:      orchestrationCtx.runId,
      projectId:  orchestrationCtx.projectId,
      goal:       orchestrationCtx.goal,
      timeoutMs:  orchestrationCtx.timeoutMs,
      mode,
      category,
      complexity,
      classification,
      startedAt:  orchestrationCtx.startedAt,
      metadata:   { ...orchestrationCtx.metadata },
    };
    contexts.set(sessionId, ctx);
    return { ...ctx };
  },

  get(sessionId: string): SupervisorContext | undefined {
    const c = contexts.get(sessionId);
    return c ? { ...c } : undefined;
  },

  getByRunId(runId: string): SupervisorContext | undefined {
    for (const c of contexts.values()) {
      if (c.runId === runId) return { ...c };
    }
    return undefined;
  },

  updateMeta(sessionId: string, key: string, value: unknown): void {
    const c = contexts.get(sessionId);
    if (c) c.metadata[key] = value;
  },

  toOrchestrationContext(sessionId: string): OrchestrationContext | undefined {
    const c = contexts.get(sessionId);
    if (!c) return undefined;
    return {
      runId:      c.runId,
      projectId:  c.projectId,
      goal:       c.goal,
      startedAt:  c.startedAt,
      timeoutMs:  c.timeoutMs,
      metadata:   c.metadata,
    };
  },

  clear(sessionId: string): void {
    contexts.delete(sessionId);
  },
};
