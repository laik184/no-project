/**
 * server/agents/verifier/coordination/verification-routing.ts
 *
 * Routes VerificationStep.type → the correct coordinator function.
 * Pure orchestration — maps step type → coordinator call → result.
 */

import type { VerificationStep, VerificationStepResult } from '../types/verifier.types.ts';
import type { ToolExecutionContext }                       from '../../../shared/types/execution-contracts.ts';
import {
  coordinateBuild,
  coordinateTypecheck,
  coordinateTests,
  coordinateServerHealth,
  coordinateRuntimeValidation,
  coordinateDependencies,
  coordinateErrorAnalysis,
  coordinateRecovery,
  VERIFIER_TOOLS,
} from './tool-coordinator.ts';
import { executeTool, resultError } from './dispatcher-client.ts';

export async function routeVerificationStep(
  step:    VerificationStep,
  context: ToolExecutionContext,
): Promise<Omit<VerificationStepResult, 'stepId' | 'durationMs' | 'attempt'>> {
  const { type, input, phase } = step;

  switch (type) {
    case 'run_build': {
      const r = await coordinateBuild(String(input.runId ?? context.runId), String(input.projectId ?? context.projectId), context, { timeoutMs: step.timeoutMs });
      return r.ok ? ok(phase, r.data) : fail(phase, resultError(r));
    }
    case 'run_typecheck': {
      const r = await coordinateTypecheck(String(input.runId ?? context.runId), String(input.projectId ?? context.projectId), context, { timeoutMs: step.timeoutMs });
      return r.ok ? ok(phase, r.data) : fail(phase, resultError(r));
    }
    case 'run_tests': {
      const r = await coordinateTests(String(input.runId ?? context.runId), String(input.projectId ?? context.projectId), context, (input.script as string) ?? 'test', { timeoutMs: step.timeoutMs });
      return r.ok ? ok(phase, r.data) : fail(phase, resultError(r));
    }
    case 'check_server_health': {
      const r = await coordinateServerHealth(String(input.runId ?? context.runId), input.port as number | undefined, context, { timeoutMs: step.timeoutMs });
      return r.ok ? ok(phase, r.data) : fail(phase, resultError(r));
    }
    case 'validate_runtime': {
      const r = await coordinateRuntimeValidation(String(input.runId ?? context.runId), input.port as number | undefined, context, { timeoutMs: step.timeoutMs });
      return r.ok ? ok(phase, r.data) : fail(phase, resultError(r));
    }
    case 'validate_dependencies': {
      const r = await coordinateDependencies(String(input.runId ?? context.runId), String(input.projectId ?? context.projectId), context, { timeoutMs: step.timeoutMs });
      return r.ok ? ok(phase, r.data) : fail(phase, resultError(r));
    }
    case 'analyze_errors': {
      const r = await coordinateErrorAnalysis(String(input.runId ?? context.runId), String(input.output ?? ''), context);
      return r.ok ? ok(phase, r.data) : fail(phase, resultError(r));
    }
    case 'verifier_failure_recovery': {
      const r = await coordinateRecovery(String(input.runId ?? context.runId), String(input.phase ?? phase), String(input.error ?? ''), context);
      return r.ok ? ok(phase, r.data) : fail(phase, resultError(r));
    }
    case 'detect_root_causes': {
      const r = await executeTool(VERIFIER_TOOLS.DETECT_ROOT_CAUSES, {
        runId: String(input.runId ?? context.runId),
        error: String(input.error ?? input.output ?? ''),
        output: input.output,
      }, context, { timeoutMs: step.timeoutMs ?? 10_000 });
      return r.ok ? ok(phase, r.data) : fail(phase, resultError(r));
    }
    case 'validate_endpoints': {
      const port = input.port as number | undefined;
      if (!port && !Array.isArray(input.endpoints)) {
        return fail(phase, 'validate_endpoints requires input.port or input.endpoints and has no standalone registered tool');
      }
      const r = await executeTool(VERIFIER_TOOLS.CHECK_SERVER_HEALTH, {
        runId: String(input.runId ?? context.runId),
        port,
      }, context, { timeoutMs: step.timeoutMs ?? 15_000 });
      return r.ok ? ok(phase, r.data) : fail(phase, resultError(r));
    }
    case 'checkpoint':
      return fail(phase, 'checkpoint has no registered persistence-backed verifier tool and cannot report success');
    case 'validate_output':
    case 'validate_execution':
    case 'build_diagnostics_report':
      return fail(phase, `${type} has no registered tool-backed side effect and cannot report success`);
    default:
      return fail(phase, `Unknown verification step type: ${type}`);
  }
}

function ok(phase: VerificationStep['phase'], output: unknown): Omit<VerificationStepResult, 'stepId' | 'durationMs' | 'attempt'> {
  return { phase, success: true, output };
}

function fail(phase: VerificationStep['phase'], error: string): Omit<VerificationStepResult, 'stepId' | 'durationMs' | 'attempt'> {
  return { phase, success: false, error };
}
