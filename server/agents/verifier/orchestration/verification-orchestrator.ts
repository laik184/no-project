/**
 * orchestration/verification-orchestrator.ts
 * The top-level orchestrator — entry point for all verification runs.
 * Coordinates: plan → validate → execute → diagnose → report.
 */

import type { VerificationInput, VerificationResult } from '../types/verifier.types.ts';
import { createVerifierContext } from '../core/verifier-context.ts';
import { buildVerificationPlan, planSummary } from '../planning/verification-planner.ts';
import { controlledExecution }  from './execution-controller.ts';
import { buildDiagnosticsReportFromPhases } from '../diagnostics/diagnostics-builder.ts';
import { verifierLogger }        from '../telemetry/verifier-logger.ts';
import { verifierMetrics }       from '../telemetry/verifier-metrics.ts';
import { verificationMonitor }   from '../monitoring/verification-monitor.ts';
import { cleanupSession }        from '../core/verifier-session.ts';
import { verifierState }         from '../core/verifier-state.ts';

export class VerificationOrchestrator {
  async run(input: VerificationInput): Promise<VerificationResult> {
    const ctx  = createVerifierContext(input);
    const plan = buildVerificationPlan(input);

    verifierLogger.info(input.runId, 'Orchestrator: plan built', {
      summary: planSummary(plan),
    });

    verificationMonitor.onRunStart(input.runId, input.projectId, plan.phases);

    const { result, aborted, abortReason } = await controlledExecution(ctx, plan);

    if (aborted || !result) {
      verifierLogger.error(input.runId, 'Orchestrator: run aborted', { reason: abortReason });
      verifierMetrics.increment(input.runId, 'runs.aborted');
      return this.buildAbortedResult(input, abortReason ?? 'Unknown abort reason');
    }

    const failedPhases = result.phases.filter((p) => p.status === 'failed');
    if (failedPhases.length > 0) {
      verifierLogger.info(input.runId, 'Building diagnostics for failed phases');
      await buildDiagnosticsReportFromPhases(
        ctx.toolContext,
        failedPhases,
      );
    }

    verificationMonitor.onRunComplete(input.runId, result.overallStatus, result.durationMs);
    verifierLogger.info(input.runId, 'Orchestrator: run complete', {
      status:     result.overallStatus,
      durationMs: result.durationMs,
    });

    return result;
  }

  async cleanup(runId: string): Promise<void> {
    cleanupSession(runId);
    verifierState.clear(runId);
  }

  private buildAbortedResult(input: VerificationInput, reason: string): VerificationResult {
    return {
      runId:         input.runId,
      projectId:     input.projectId,
      overallStatus: 'failed',
      phases:        [],
      startedAt:     new Date(),
      completedAt:   new Date(),
      durationMs:    0,
      errorCount:    1,
      warningCount:  0,
    };
  }
}

export const verificationOrchestrator = new VerificationOrchestrator();
