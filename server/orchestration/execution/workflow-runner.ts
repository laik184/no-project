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
  OrchestrationContext,
  OrchestrationRetryConfig,
} from '../types/orchestration.types.ts';
import { runPhase }               from './phase-runner.ts';
import { setActiveWorkflow, recordWorkflowDone } from '../monitoring/orchestration-monitor.ts';
import { recordWorkflowStarted, recordWorkflowCompleted, recordWorkflowFailed } from '../telemetry/orchestration-metrics.ts';
import { logWorkflowStarted, logWorkflowCompleted, logWorkflowFailed } from '../telemetry/orchestration-logger.ts';
import { publishWorkflowStarted, publishWorkflowCompleted, publishWorkflowFailed } from '../events/event-publisher.ts';
import { DEFAULT_RETRY_CONFIG }   from './retry-manager.ts';

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

  const phaseResults: PhaseResult[] = [];
  const phaseMap = new Map(workflow.phases.map(p => [p.phaseId, p]));
  const waves    = buildPhaseOrder(workflow);

  for (const wave of waves) {
    // Phases within a wave that have no mutual deps can run in parallel
    const wavePhases = wave.map(id => phaseMap.get(id)).filter(Boolean) as typeof workflow.phases;

    const results = await Promise.all(
      wavePhases.map(phase =>
        runPhase(phase, workflow.workflowId, ctx, retryConfig),
      ),
    );

    phaseResults.push(...results);

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
