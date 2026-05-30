/**
 * server/orchestration/execution/workflow-runner.ts
 *
 * Orchestrates workflow execution: iterates phases in dependency order,
 * aggregates results, and reports workflow-level outcomes.
 * Orchestration-only — all execution flows through phase-runner.
 */

import type {
  Workflow,
  WorkflowResult,
  PhaseResult,
  Phase,
  OrchestrationContext,
  OrchestrationRetryConfig,
} from '../types/orchestration.types.ts';
import { runPhase }               from './phase-runner.ts';
import { setActiveWorkflow, recordWorkflowDone } from '../monitoring/orchestration-monitor.ts';
import { recordWorkflowStarted, recordWorkflowCompleted, recordWorkflowFailed } from '../telemetry/orchestration-metrics.ts';
import { logWorkflowStarted, logWorkflowCompleted, logWorkflowFailed } from '../telemetry/orchestration-logger.ts';
import { publishWorkflowStarted, publishWorkflowCompleted, publishWorkflowFailed } from '../events/event-publisher.ts';
import { DEFAULT_RETRY_CONFIG }   from './retry-manager.ts';
import { buildMemoryContext }     from '../../memory/context/memory-context-builder.ts';

// ── Phase dependency ordering ─────────────────────────────────────────────────

function buildPhaseOrder(workflow: Workflow): string[][] {
  const phases   = workflow.phases;
  const idSet    = new Set(phases.map(p => p.phaseId));
  const resolved = new Set<string>();
  const waves:   string[][] = [];

  const remaining = () => phases.filter(p => !resolved.has(p.phaseId));

  while (resolved.size < phases.length) {
    const wave = remaining().filter(
      p => (p.dependsOn ?? []).every(d => !idSet.has(d) || resolved.has(d)),
    );
    if (wave.length === 0) break; // cycle guard
    waves.push(wave.map(p => p.phaseId));
    wave.forEach(p => resolved.add(p.phaseId));
  }

  return waves;
}

// ── Phase output enrichment ───────────────────────────────────────────────────

/**
 * Build an enriched copy of a phase with upstream outputs injected into input.
 *
 * Rules:
 *   - If a dependency is a 'planner' phase and produced a plan, inject it as
 *     `input.plan` so the executor consumes the real planner-generated task list.
 *   - If a dependency is an 'executor' phase, inject its output as
 *     `input.executorOutput` so the verifier has access to execution context.
 *
 * The original frozen phase object is never mutated — a new object is returned.
 */
function enrichPhase(
  phase:   Phase,
  phaseMap: Map<string, Phase>,
  outputs:  Map<string, unknown>,
): Phase {
  const deps = phase.dependsOn ?? [];
  if (deps.length === 0) return phase;

  const extra: Record<string, unknown> = {};

  for (const depId of deps) {
    const depPhase  = phaseMap.get(depId);
    const depOutput = outputs.get(depId);
    if (!depOutput || !depPhase) continue;

    switch (depPhase.agentType) {
      case 'planner': {
        const pr = depOutput as { plan?: unknown; success?: boolean };
        if (pr.plan !== undefined) extra.plan = pr.plan;
        break;
      }
      case 'executor': {
        extra.executorOutput = depOutput;
        break;
      }
    }
  }

  if (Object.keys(extra).length === 0) return phase;
  return { ...phase, input: { ...phase.input, ...extra } };
}

// ── Workflow runner ───────────────────────────────────────────────────────────

export async function runWorkflow(
  workflow:   Workflow,
  ctx:        OrchestrationContext,
  retryConfig: OrchestrationRetryConfig = DEFAULT_RETRY_CONFIG,
  stopOnFail: boolean = true,
): Promise<WorkflowResult> {
  const start = Date.now();

  recordWorkflowStarted(ctx.runId);
  setActiveWorkflow(ctx.orchestrationId, workflow.workflowId);
  logWorkflowStarted(ctx.orchestrationId, workflow.workflowId, workflow.name);
  publishWorkflowStarted(ctx, workflow.workflowId, workflow.name);

  // Recall memory context for this workflow
  const memCtx = await buildMemoryContext(workflow.name, {
    categories: ['execution', 'learning', 'bug'],
  });
  if (memCtx.totalFound > 0) {
    console.log(`[workflow-runner] Memory context for "${workflow.name}" — ${memCtx.totalFound} records, hasGraph=${memCtx.hasGraphData}`);
  }

  const phaseResults: PhaseResult[] = [];
  const phaseMap    = new Map(workflow.phases.map(p => [p.phaseId, p]));
  const phaseOutputs = new Map<string, unknown>();
  const waves       = buildPhaseOrder(workflow);

  for (const wave of waves) {
    // Enrich each phase with outputs from completed upstream phases
    const wavePhases = wave
      .map(id => phaseMap.get(id))
      .filter(Boolean)
      .map(phase => enrichPhase(phase!, phaseMap, phaseOutputs)) as Phase[];

    const results = await Promise.all(
      wavePhases.map(phase =>
        runPhase(phase, workflow.workflowId, ctx, retryConfig),
      ),
    );

    phaseResults.push(...results);

    // Record outputs so subsequent waves can consume them
    for (const r of results) {
      if (r.ok && r.output !== undefined) {
        phaseOutputs.set(r.phaseId, r.output);
      }
    }

    const failed = results.filter(r => !r.ok);
    if (failed.length > 0 && stopOnFail) {
      const durationMs = Date.now() - start;
      const error      = failed[0].error ?? 'Phase failed';

      recordWorkflowFailed(ctx.runId);
      logWorkflowFailed(ctx.orchestrationId, workflow.workflowId, error);
      publishWorkflowFailed(ctx, workflow.workflowId, error);

      return { workflowId: workflow.workflowId, ok: false, phaseResults, durationMs, error };
    }
  }

  const durationMs = Date.now() - start;
  const allOk      = phaseResults.every(r => r.ok);

  if (allOk) {
    recordWorkflowCompleted(ctx.runId);
    recordWorkflowDone(ctx.orchestrationId);
    logWorkflowCompleted(ctx.orchestrationId, workflow.workflowId, durationMs);
    publishWorkflowCompleted(ctx, { workflowId: workflow.workflowId, ok: true, phaseResults, durationMs });
    return { workflowId: workflow.workflowId, ok: true, phaseResults, durationMs };
  }

  const error = phaseResults.find(r => !r.ok)?.error ?? 'Unknown workflow failure';
  recordWorkflowFailed(ctx.runId);
  logWorkflowFailed(ctx.orchestrationId, workflow.workflowId, error);
  publishWorkflowFailed(ctx, workflow.workflowId, error);
  return { workflowId: workflow.workflowId, ok: false, phaseResults, durationMs, error };
}
