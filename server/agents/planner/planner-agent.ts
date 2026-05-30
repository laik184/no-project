/**
 * server/agents/planner/planner-agent.ts
 *
 * ENTRY POINT for the planner agent orchestration layer.
 *
 * Responsibilities:
 *   - validate incoming planning requests
 *   - recall relevant memory context before planning
 *   - build planning context
 *   - open/close session lifecycle
 *   - delegate to planning-loop
 *   - return structured results
 *
 * Architecture: orchestration ONLY.
 * No child_process. No spawn. No exec. No shell. No direct tool execution.
 */

import type { PlanningRequest, PlanningResult } from './types/planner.types.ts';
import { buildPlanningContext }                  from './core/planner-context.ts';
import { plannerSession }                        from './core/planner-session.ts';
import { plannerMetrics }                        from './telemetry/planner-metrics.ts';
import { plannerLogger }                         from './telemetry/planner-logger.ts';
import { planningMonitor }                       from './monitoring/planning-monitor.ts';
import { validatePlanningRequest, validateRuntimeContext } from './validation/planning-validator.ts';
import { runPlanningLoop }                       from './execution/planning-loop.ts';
import { makeRunId }                             from './utils/planning-utils.ts';
import { memoryEngine, graphTraversal, graphStore } from '../../memory/index.ts';

// ── Memory recall ──────────────────────────────────────────────────────────────

interface PlanningMemoryContext {
  pastDecisions:    string[];
  knownFailures:    string[];
  topLessons:       string[];
  graphInsights:    string[];
}

// ── Phase 5: Knowledge-graph enrichment ──────────────────────────────────────

function _recallGraphInsights(goal: string): string[] {
  try {
    const allEntities = graphStore.listEntities();
    if (allEntities.length === 0) return [];

    // Score graph entities by keyword overlap with the planning goal
    const keywords = goal.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    if (keywords.length === 0) return [];

    const scored = allEntities.map(e => {
      const text = `${e.label} ${e.description}`.toLowerCase();
      const hits  = keywords.filter(k => text.includes(k)).length;
      return { entity: e, score: hits };
    }).filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const insights: string[] = [];
    for (const { entity } of scored) {
      const neighbours = graphTraversal.neighbours(entity.id).slice(0, 5);
      const ctxLines = neighbours.map(n => `  → ${n.kind}:${n.label}: ${n.description.slice(0, 80)}`);
      insights.push(`[${entity.kind}:${entity.label}] ${entity.description.slice(0, 100)}\n${ctxLines.join('\n')}`);
    }
    return insights;
  } catch {
    return [];
  }
}

async function _recallPlanningMemory(goal: string): Promise<PlanningMemoryContext> {
  try {
    const [decisions, failures, lessons] = await Promise.all([
      memoryEngine.searchCategory('decision', goal.slice(0, 100), 3),
      memoryEngine.searchCategory('bug', 'failure error', 5),
      memoryEngine.searchCategory('reflection', goal.slice(0, 100), 3),
    ]);

    // Phase 5: knowledge graph enrichment (synchronous — graph is in-memory)
    const graphInsights = _recallGraphInsights(goal);

    return {
      pastDecisions:  decisions.map(e => e.content.slice(0, 200)),
      knownFailures:  failures.map(e => e.content.slice(0, 200)),
      topLessons:     lessons.map(e => e.content.slice(0, 200)),
      graphInsights,
    };
  } catch {
    return { pastDecisions: [], knownFailures: [], topLessons: [], graphInsights: [] };
  }
}

// ── Agent lifecycle ───────────────────────────────────────────────────────────

let _initialized = false;

export function initializePlanner(): void {
  if (_initialized) return;
  _initialized = true;
  console.log('[planner-agent] Initialized — event handlers registered');
}

export function shutdownPlanner(): void {
  _initialized = false;
  console.log('[planner-agent] Shut down');
}

// ── Orchestration-layer cycle API ─────────────────────────────────────────────

export interface PlannerCycleResult {
  success:      boolean;
  planId?:      string;
  plan?:        import('./types/planner.types.ts').ExecutionPlan;
  failedPhase?: string;
  error?:       string;
}

/**
 * High-level cycle entry point called by the Orchestrator.
 * Drives a full planning pass for a run goal.
 */
export async function runPlannerCycle(ctx: {
  runId:     string;
  projectId: string;
  goal:      string;
  metadata?: Record<string, unknown>;
}): Promise<PlannerCycleResult> {
  try {
    const result = await plan({
      runId:       ctx.runId,
      projectId:   ctx.projectId,
      sandboxRoot: process.env.AGENT_PROJECT_ROOT ?? '.sandbox',
      goal:        ctx.goal,
      meta:        ctx.metadata ?? {},
    });
    return {
      success:     result.success,
      planId:      result.plan?.planId,
      plan:        result.plan,
      error:       result.errors[0],
      failedPhase: result.success ? undefined : 'planning',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, failedPhase: 'planning', error: message };
  }
}

// ── Main entry ────────────────────────────────────────────────────────────────

export async function plan(req: PlanningRequest): Promise<PlanningResult> {
  const runId = req.runId ?? makeRunId();
  const { projectId, sandboxRoot, goal, signal, meta = {} } = req;

  plannerLogger.info(runId, 'Planning session requested', { projectId, goal: goal.slice(0, 80) });

  // ── 1. Validate request ───────────────────────────────────────────────────
  const requestValidation = validatePlanningRequest(req);
  if (!requestValidation.valid) {
    plannerLogger.error(runId, 'Request validation failed', {
      errors: requestValidation.errors,
    });
    return failed(runId, 0, requestValidation.errors);
  }
  if (requestValidation.warnings.length > 0) {
    plannerLogger.warn(runId, 'Request validation warnings', {
      warnings: requestValidation.warnings,
    });
  }

  // ── 2. Validate runtime context ───────────────────────────────────────────
  const contextValidation = validateRuntimeContext(runId, projectId, sandboxRoot);
  if (!contextValidation.valid) {
    plannerLogger.error(runId, 'Context validation failed', {
      errors: contextValidation.errors,
    });
    return failed(runId, 0, contextValidation.errors);
  }

  // ── 3. Open session ───────────────────────────────────────────────────────
  plannerSession.open({ runId, projectId, sandboxRoot, goal });
  plannerSession.transition(runId, 'validating');
  plannerMetrics.initRun(runId);
  planningMonitor.initRun(runId);

  // ── 4. Recall memory context before planning ──────────────────────────────
  const memoryContext = await _recallPlanningMemory(goal);
  const hasPriorContext = memoryContext.pastDecisions.length > 0
    || memoryContext.knownFailures.length > 0
    || memoryContext.topLessons.length > 0
    || memoryContext.graphInsights.length > 0;
  if (hasPriorContext) {
    plannerLogger.info(runId, 'Memory context loaded', {
      pastDecisions:  memoryContext.pastDecisions.length,
      knownFailures:  memoryContext.knownFailures.length,
      topLessons:     memoryContext.topLessons.length,
      graphInsights:  memoryContext.graphInsights.length,
    });
  }

  // ── 5. Build context (with memory injected into meta) ────────────────────
  const enrichedMeta = { ...meta, memory: memoryContext };
  const context = buildPlanningContext(runId, projectId, sandboxRoot, goal, enrichedMeta, signal);

  // ── 6. Run planning loop ──────────────────────────────────────────────────
  const startedAt = Date.now();

  const executionPlan = await runPlanningLoop(context);
  const durationMs    = Date.now() - startedAt;

  plannerMetrics.finalise(runId);

  if (!executionPlan) {
    const monitorErrors = planningMonitor
      .listFailures(runId)
      .map((f) => f.error)
      .slice(0, 3);

    const errors = monitorErrors.length > 0
      ? monitorErrors
      : ['Planning loop produced no execution plan'];

    plannerSession.close(runId, false, durationMs);
    plannerLogger.sessionEnd(runId, false, durationMs);
    return failed(runId, durationMs, errors);
  }

  // ── 7. Close session ──────────────────────────────────────────────────────
  plannerSession.close(runId, true, durationMs);
  plannerLogger.sessionEnd(runId, true, durationMs);

  // ── 8. Persist to memory platform (fire-and-forget) ───────────────────────
  memoryEngine.store({
    category: 'decision',
    content:  JSON.stringify({ goal, planId: executionPlan.planId, durationMs }),
    tags:     ['planning', 'goal'],
    score:    1.0,
    meta:     { runId, projectId, agentSource: 'planner' },
  }).catch(console.error);
  memoryEngine.store({
    category: 'architecture',
    content:  JSON.stringify({ planId: executionPlan.planId, taskCount: (executionPlan as any).tasks?.length ?? 0 }),
    tags:     ['architecture', 'execution-plan'],
    score:    0.9,
    meta:     { runId, projectId, agentSource: 'planner' },
  }).catch(console.error);

  return {
    runId,
    success:    true,
    plan:       executionPlan,
    durationMs,
    errors:     [],
  };
}

// ── createExecutionPlan — caller-friendly wrapper ─────────────────────────────

export interface CreateExecutionPlanInput {
  runId?:      string;
  projectId:   string | number;
  goal:        string;
  timeoutMs?:  number;
  metadata?:   Record<string, unknown>;
}

export interface CreateExecutionPlanResult {
  ok:         boolean;
  plan?:      import('./types/planner.types.ts').ExecutionPlan;
  error?:     string;
  durationMs: number;
}

/**
 * High-level wrapper used by the orchestration and chat layers.
 * Returns `{ ok, plan, error, durationMs }` — never throws.
 */
export async function createExecutionPlan(
  input: CreateExecutionPlanInput,
): Promise<CreateExecutionPlanResult> {
  try {
    const result = await plan({
      runId:       input.runId,
      projectId:   String(input.projectId),
      sandboxRoot: process.env.AGENT_PROJECT_ROOT ?? '.sandbox',
      goal:        input.goal,
      meta:        input.metadata ?? {},
    });

    if (result.success && result.plan) {
      return { ok: true, plan: result.plan, durationMs: result.durationMs };
    }

    return {
      ok:         false,
      error:      result.errors[0] ?? 'Planning failed',
      durationMs: result.durationMs,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message, durationMs: 0 };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function failed(
  runId:      string,
  durationMs: number,
  errors:     string[],
): PlanningResult {
  return { runId, success: false, durationMs, errors };
}
