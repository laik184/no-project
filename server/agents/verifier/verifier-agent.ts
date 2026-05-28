/**
 * server/agents/verifier/verifier-agent.ts
 *
 * ENTRY POINT for the verifier agent orchestration layer.
 *
 * Responsibilities:
 *   - validate incoming VerifierInput
 *   - build verifier execution context
 *   - build verification steps from requested phases
 *   - delegate to verification-runner
 *   - return structured VerifierOutput
 *
 * Architecture: orchestration ONLY.
 * No spawn. No exec. No shell. No fetch. No direct tool execution.
 */

import type { VerifierInput, VerifierOutput, VerificationPhase } from './types/verifier.types.ts';
import { buildVerifierContext }         from './core/verifier-context.ts';
import { runVerifier }                  from './execution/verification-runner.ts';
import { validateVerifierInput }        from './validation/verification-validator.ts';
import { verifierLogger }               from './telemetry/verifier-logger.ts';
import { verifierMetrics }              from './telemetry/verifier-metrics.ts';
import { verifierHealthMonitor }        from './monitoring/health-monitor.ts';
import { makeRunId, defaultSteps }      from './utils/verification-utils.ts';

// ── Agent lifecycle ───────────────────────────────────────────────────────────

let _initialised = false;

export function initializeVerifier(): void {
  if (_initialised) return;
  _initialised = true;
  console.log('[verifier-agent] Initialized — orchestration layer ready');
}

export function shutdownVerifier(): void {
  _initialised = false;
  console.log('[verifier-agent] Shut down');
}

// ── Default phases ────────────────────────────────────────────────────────────

const DEFAULT_PHASES: VerificationPhase[] = ['typecheck', 'build', 'runtime'];

// ── Main entry ────────────────────────────────────────────────────────────────

export async function runVerification(req: VerifierInput): Promise<VerifierOutput> {
  const runId     = req.runId ?? makeRunId();
  const projectId = String(req.projectId);
  const phases    = (req.phases && req.phases.length > 0) ? req.phases : DEFAULT_PHASES;
  const timeoutMs = req.timeoutMs ?? 120_000;

  verifierLogger.lifecycle(runId, 'verification-requested', { projectId, phases });
  verifierMetrics.startRun(runId);

  // ── 1. Validate request ───────────────────────────────────────────────────
  const validation = validateVerifierInput({ ...req, runId, phases });
  if (!validation.valid) {
    verifierLogger.error(runId, 'Request validation failed', { errors: validation.errors });
    return failedOutput(runId, phases, 0, validation.errors);
  }
  if (validation.warnings.length > 0) {
    verifierLogger.warn(runId, 'Request validation warnings', { warnings: validation.warnings });
  }

  // ── 2. Check agent health ─────────────────────────────────────────────────
  if (!verifierHealthMonitor.isHealthy()) {
    verifierLogger.warn(runId, 'Verifier runtime degraded', {
      active: verifierHealthMonitor.activeCount(),
    });
  }

  // ── 3. Build execution context ────────────────────────────────────────────
  const context = buildVerifierContext(
    runId,
    projectId,
    phases,
    req.sandboxRoot,
    req.port,
    timeoutMs,
  );

  // ── 4. Build verification steps ───────────────────────────────────────────
  const steps = defaultSteps(runId, projectId, phases);

  if (steps.length === 0) {
    verifierLogger.warn(runId, 'No verification steps generated', { phases });
    return failedOutput(runId, phases, 0, ['No verification steps could be generated for phases: ' + phases.join(', ')]);
  }

  // ── 5. Delegate to verification runner ────────────────────────────────────
  const startedAt = Date.now();
  const result    = await runVerifier(steps, context);
  const durationMs = Date.now() - startedAt;

  const errors = result.outcomes
    .filter((o) => !o.success && o.error)
    .map((o) => o.error as string);

  verifierLogger.lifecycle(runId, 'verification-complete', {
    ok: result.success, durationMs, steps: result.outcomes.length,
  });

  return {
    ok:         result.success,
    runId,
    phases,
    steps:      result.outcomes,
    durationMs,
    errors,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function failedOutput(
  runId:      string,
  phases:     VerificationPhase[],
  durationMs: number,
  errors:     string[],
): VerifierOutput {
  return { ok: false, runId, phases, steps: [], durationMs, errors };
}
