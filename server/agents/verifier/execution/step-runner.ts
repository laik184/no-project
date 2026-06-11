/**
 * server/agents/verifier/execution/step-runner.ts
 *
 * Executes ONE verification step by dispatching directly to dispatcher-client.
 * No intermediate routing layers — no verification-routing.ts, no tool-coordinator.ts.
 *
 * Execution chain: step-runner → dispatcher-client → tool-dispatcher → registry → tool
 *
 * Pure orchestration: VerificationStep → VerificationStepResult.
 * No spawn, exec, shell, fetch, or direct tool logic.
 */

import type { VerificationStep, VerificationStepResult, VerificationPhase } from '../types/verifier.types.ts';
import type { ToolExecutionContext }                       from '../coordination/dispatcher-client.ts';
import { executeTool, resultError }                       from '../coordination/dispatcher-client.ts';
import { VERIFIER_TOOLS }                                 from '../coordination/tool-coordinator.ts';
import { withRetry, policyForStepType }                   from './retry-manager.ts';
import { verifierLogger }                                 from '../telemetry/verifier-logger.ts';
import { elapsedMs }                                      from '../utils/verification-utils.ts';

// ── Step route result ─────────────────────────────────────────────────────────

type StepRouteResult =
  | { success: true;  phase: VerificationPhase; output: unknown }
  | { success: false; phase: VerificationPhase; error: string };

// ── Inline routing: step.type → tool dispatch ─────────────────────────────────

async function dispatchVerificationStep(
  step:    VerificationStep,
  context: ToolExecutionContext,
): Promise<StepRouteResult> {
  const { type, input, phase, timeoutMs } = step;
  const runId     = String(input.runId     ?? context.runId);
  const projectId = String(input.projectId ?? context.projectId);

  switch (type) {
    case 'run_build': {
      const r = await executeTool(VERIFIER_TOOLS.RUN_BUILD,
        { runId, projectId }, context, { timeoutMs: timeoutMs ?? 120_000 });
      return r.ok ? okR(phase, r.data) : failR(phase, resultError(r));
    }

    case 'run_typecheck': {
      const r = await executeTool(VERIFIER_TOOLS.RUN_TYPECHECK,
        { runId, projectId }, context, { timeoutMs: timeoutMs ?? 60_000 });
      return r.ok ? okR(phase, r.data) : failR(phase, resultError(r));
    }

    case 'run_tests': {
      const script = (input.script as string) ?? 'test';
      const r = await executeTool(VERIFIER_TOOLS.RUN_TESTS,
        { runId, projectId, script }, context, { timeoutMs: timeoutMs ?? 120_000 });
      return r.ok ? okR(phase, r.data) : failR(phase, resultError(r));
    }

    case 'check_server_health': {
      const port = input.port as number | undefined;
      const r = await executeTool(VERIFIER_TOOLS.CHECK_SERVER_HEALTH,
        { runId, port }, context, { timeoutMs: timeoutMs ?? 15_000 });
      return r.ok ? okR(phase, r.data) : failR(phase, resultError(r));
    }

    case 'validate_runtime': {
      const port = input.port as number | undefined;
      const r = await executeTool(VERIFIER_TOOLS.VALIDATE_RUNTIME,
        { runId, port }, context, { timeoutMs: timeoutMs ?? 60_000 });
      return r.ok ? okR(phase, r.data) : failR(phase, resultError(r));
    }

    case 'validate_dependencies': {
      const r = await executeTool(VERIFIER_TOOLS.VALIDATE_DEPS,
        { runId, projectId }, context, { timeoutMs: timeoutMs ?? 10_000 });
      return r.ok ? okR(phase, r.data) : failR(phase, resultError(r));
    }

    case 'analyze_errors': {
      const output = String(input.output ?? '');
      const r = await executeTool(VERIFIER_TOOLS.ANALYZE_ERRORS,
        { runId, output }, context, { timeoutMs: timeoutMs ?? 5_000 });
      return r.ok ? okR(phase, r.data) : failR(phase, resultError(r));
    }

    case 'verifier_failure_recovery': {
      const errMsg = String(input.error ?? '');
      const phaseStr = String(input.phase ?? phase);
      const r = await executeTool(VERIFIER_TOOLS.FAILURE_RECOVERY,
        { runId, phase: phaseStr, error: errMsg }, context, { timeoutMs: timeoutMs ?? 2_000 });
      return r.ok ? okR(phase, r.data) : failR(phase, resultError(r));
    }

    case 'checkpoint':
      return okR(phase, { checkpointAt: Date.now() });

    case 'validate_output':
    case 'validate_execution':
    case 'detect_root_causes':
    case 'build_diagnostics_report':
    case 'validate_endpoints':
      return okR(phase, { message: `${type} delegated`, step: step.id });

    default:
      return failR(phase, `Unknown verification step type: ${type}`);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function semanticFailure(output: unknown): string | null {
  if (!output || typeof output !== 'object') return null;
  const record = output as Record<string, unknown>;

  if (record.passed === false) {
    return String(record.error ?? record.stderr ?? record.stdout ?? 'Verification tool reported passed=false');
  }
  if (record.healthy === false) {
    return String(record.error ?? 'Health check reported healthy=false');
  }
  if (typeof record.exitCode === 'number' && record.exitCode !== 0) {
    return String(record.stderr ?? record.stdout ?? `Process exited with code ${record.exitCode}`);
  }
  if (record.success === false || record.ok === false) {
    return String(record.error ?? 'Verification tool reported failure');
  }

  return null;
}

function okR(phase: VerificationPhase, output: unknown): StepRouteResult {
  const failure = semanticFailure(output);
  return failure ? failR(phase, failure) : { success: true, phase, output };
}

function failR(phase: VerificationPhase, error: string): StepRouteResult {
  return { success: false, phase, error };
}

// ── Public interface ──────────────────────────────────────────────────────────

export async function runVerificationStep(
  step:    VerificationStep,
  context: ToolExecutionContext,
): Promise<VerificationStepResult> {
  const startedAt = new Date();
  const policy    = policyForStepType(step.type);

  verifierLogger.step(context.runId, step.id, 'start', {
    type: step.type, phase: step.phase, label: step.label,
  });

  const retryResult = await withRetry(
    () => dispatchVerificationStep(step, context),
    { runId: context.runId, stepId: step.id, policy },
    (r) => r.success,
  );

  const durationMs = elapsedMs(startedAt);
  const attempt    = retryResult.attempts;

  const routeVal = retryResult.success ? retryResult.value : null;
  const outcome: VerificationStepResult = routeVal?.success
    ? {
        stepId:  step.id,
        phase:   step.phase,
        success: true,
        durationMs,
        attempt,
        output: routeVal.output,
      }
    : {
        stepId:  step.id,
        phase:   step.phase,
        success: false,
        durationMs,
        attempt,
        error:   (routeVal as unknown as { error?: string } | null)?.error ?? (retryResult as { lastError?: string }).lastError ?? 'Step failed',
      };

  verifierLogger.step(context.runId, step.id, outcome.success ? 'complete' : 'fail', {
    durationMs, attempt, error: outcome.error,
  });

  return outcome;
}
