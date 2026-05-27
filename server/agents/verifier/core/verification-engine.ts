import type { VerificationInput, PhaseResult, VerificationPhase } from '../types/verifier.types.ts';
import { runTypecheck }   from '../typecheck/typescript-checker.ts';
import { runBuild }       from '../build/build-runner.ts';
import { checkRuntime }   from '../runtime/runtime-checker.ts';
import { runTests }       from '../testing/test-runner.ts';
import { toPhaseResult as buildPhaseResult }   from '../reports/build-report.ts';
import { toPhaseResult as runtimePhaseResult } from '../reports/runtime-report.ts';
import { toPhaseResult as testPhaseResult }    from '../reports/test-report.ts';
import { performanceTracker } from '../telemetry/performance-tracker.ts';
import { verifierLogger }     from '../telemetry/verifier-logger.ts';

export async function runVerificationPhase(
  phase:   VerificationPhase,
  input:   VerificationInput,
): Promise<PhaseResult> {
  const { runId, projectId } = input;
  performanceTracker.startPhase(runId, phase);

  try {
    switch (phase) {
      case 'typecheck': {
        const result     = await runTypecheck(runId, projectId);
        const durationMs = performanceTracker.endPhase(runId, phase);
        return {
          phase,
          status:     result.passed ? 'passed' : 'failed',
          durationMs,
          errors:     result.errors.map((e) => e.message),
          warnings:   [],
          output:     result.report.summary,
        };
      }

      case 'build': {
        const result     = await runBuild(runId, projectId);
        const durationMs = performanceTracker.endPhase(runId, phase);
        return buildPhaseResult(result, durationMs);
      }

      case 'runtime':
      case 'endpoints': {
        const result     = await checkRuntime(runId, {
          port:      input.port,
          endpoints: phase === 'endpoints' ? input.endpoints : [],
          timeoutMs: input.timeoutMs,
        });
        const durationMs = performanceTracker.endPhase(runId, phase);
        return runtimePhaseResult(result, durationMs);
      }

      case 'tests': {
        const result     = await runTests(runId, projectId);
        const durationMs = performanceTracker.endPhase(runId, phase);
        return testPhaseResult(result, durationMs);
      }

      default: {
        performanceTracker.endPhase(runId, phase);
        verifierLogger.warn(runId, `Unknown phase: ${phase}`);
        return { phase, status: 'skipped', durationMs: 0, errors: [], warnings: [] };
      }
    }
  } catch (err) {
    const durationMs = performanceTracker.endPhase(runId, phase);
    const message    = err instanceof Error ? err.message : String(err);
    verifierLogger.error(runId, `Phase ${phase} threw: ${message}`);
    return { phase, status: 'failed', durationMs, errors: [message], warnings: [] };
  }
}

export async function runAllPhases(input: VerificationInput): Promise<PhaseResult[]> {
  const results: PhaseResult[] = [];
  for (const phase of input.phases) {
    const result = await runVerificationPhase(phase, input);
    results.push(result);
    if (result.status === 'failed' && (phase === 'build' || phase === 'typecheck')) {
      verifierLogger.warn(input.runId, `Stopping early at failed phase: ${phase}`);
      break;
    }
  }
  return results;
}
