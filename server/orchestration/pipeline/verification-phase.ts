import type { OrchestrationContext, PhaseResult } from '../events/event-types.ts';
import { runLogger } from '../telemetry/run-logger.ts';
import { emitPhaseStarted, emitMetric } from '../events/orchestration-events.ts';
import { timed, withTimeout } from '../utils/execution-utils.ts';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export type VerificationCheckName = 'typescript' | 'build' | 'lint' | 'runtime';

export interface VerificationCheck {
  name: VerificationCheckName;
  passed: boolean;
  durationMs: number;
  output: string;
  error?: string;
}

export interface VerificationReport {
  allPassed: boolean;
  checks: VerificationCheck[];
  blockers: string[];
}

async function runCheck(name: VerificationCheckName, cmd: string, cwd: string): Promise<VerificationCheck> {
  const start = Date.now();
  try {
    const { stdout, stderr } = await withTimeout(
      () => execAsync(cmd, { cwd }),
      { timeoutMs: 60_000 }
    );
    return {
      name,
      passed: true,
      durationMs: Date.now() - start,
      output: (stdout + stderr).trim().slice(0, 2000),
    };
  } catch (err) {
    const output = err instanceof Error ? err.message.slice(0, 2000) : String(err);
    return {
      name,
      passed: false,
      durationMs: Date.now() - start,
      output,
      error: `Check "${name}" failed`,
    };
  }
}

export async function runVerificationPhase(ctx: OrchestrationContext, projectRoot: string): Promise<PhaseResult> {
  emitPhaseStarted(ctx.runId, 'verification');
  runLogger.log(ctx.runId, 'info', '[verification-phase] Running verification checks');

  const { result: report, durationMs } = await timed(async (): Promise<VerificationReport> => {
    const checks: VerificationCheck[] = [];

    const tsCheck = await runCheck('typescript', 'npx tsc --noEmit --skipLibCheck 2>&1 | head -50', projectRoot);
    checks.push(tsCheck);

    const buildCheck = await runCheck('build', 'npm run build 2>&1 | tail -30', projectRoot);
    checks.push(buildCheck);

    const allPassed = checks.every((c) => c.passed);
    const blockers = checks.filter((c) => !c.passed).map((c) => c.error ?? c.name);

    return { allPassed, checks, blockers };
  });

  for (const check of report.checks) {
    emitMetric(ctx.runId, `verification.${check.name}`, check.passed ? 1 : 0, 'bool');
    runLogger.log(ctx.runId, check.passed ? 'info' : 'warn', `[verification-phase] ${check.name}: ${check.passed ? 'PASS' : 'FAIL'} (${check.durationMs}ms)`);
  }

  return {
    phase: 'verification',
    success: report.allPassed,
    durationMs,
    output: report as unknown as Record<string, unknown>,
    error: report.allPassed ? undefined : `Blockers: ${report.blockers.join(', ')}`,
  };
}
