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

import { existsSync } from 'fs';
import type { VerifierInput, VerifierOutput, VerificationPhase } from './types/verifier.types.ts';
import { buildVerifierContext }         from './core/verifier-context.ts';
import { runVerifier }                  from './execution/verification-runner.ts';
import { validateVerifierInput }        from './validation/verification-validator.ts';
import { verifierLogger }               from './telemetry/verifier-logger.ts';
import { verifierMetrics }              from './telemetry/verifier-metrics.ts';
import { verifierHealthMonitor }        from './monitoring/health-monitor.ts';
import { makeRunId, defaultSteps }      from './utils/verification-utils.ts';
import { memoryEngine, buildMemoryContext } from '../../memory/index.ts';

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

  // ── Phase 3: Memory Recall ────────────────────────────────────────────────
  // Recall previous verification failures, known bug patterns, false positives.
  // Verifier should not rediscover the same mistakes.
  const recallTopic = `verification ${phases.join(' ')} typecheck build runtime`;
  const memCtx = await buildMemoryContext(recallTopic, {
    categories: ['bug', 'execution', 'reflection', 'learning'],
    limit:      8,
    minScore:   0.1,
  }).catch(() => null);

  if (memCtx && memCtx.totalFound > 0) {
    verifierLogger.lifecycle(runId, 'memory-recall-loaded', {
      totalFound:  memCtx.totalFound,
      hasGraph:    memCtx.hasGraphData,
      durationMs:  memCtx.durationMs,
    });

    // Recall recent verification failures for this phase combination
    const priorFailures = await memoryEngine.searchCategory('bug', phases.join(' '), 5).catch(() => []);
    if (priorFailures.length > 0) {
      verifierLogger.lifecycle(runId, 'memory-recall-prior-failures', {
        count:    priorFailures.length,
        patterns: priorFailures.slice(0, 3).map(e => e.content.slice(0, 80)),
      });
    }

    // Recall known regression signatures
    const regressions = await memoryEngine.searchCategory('reflection', 'regression verification fix', 3).catch(() => []);
    if (regressions.length > 0) {
      verifierLogger.lifecycle(runId, 'memory-recall-regressions', {
        count: regressions.length,
      });
    }
  }

  // ── 2b. Sandbox existence check ───────────────────────────────────────────
  // If the sandbox root doesn't exist, verification is a no-op (non-fatal).
  // This happens when AGENT_PROJECT_ROOT is unset and .sandbox hasn't been
  // written to yet — verifier tools would fail immediately with ENOENT.
  const sandboxPath = req.sandboxRoot ?? '.sandbox';
  if (!existsSync(sandboxPath)) {
    verifierLogger.warn(runId, 'Sandbox not found — skipping verification (non-fatal)', {
      sandboxRoot: sandboxPath,
      hint: 'Set AGENT_PROJECT_ROOT to a writable path or let the executor write files first',
    });
    return {
      ok:         true,
      runId,
      phases,
      steps:      [],
      durationMs: 0,
      errors:     [],
    };
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

  // Fire-and-forget: persist bug entries for any verification failures
  if (errors.length > 0) {
    memoryEngine.store({
      category: 'bug',
      content:  JSON.stringify({ phases, errors, stepsRun: result.outcomes.length }),
      tags:     ['verification', 'failure', ...phases],
      score:    0.3,
      meta:     { runId, agentSource: 'verifier' },
    }).catch(console.error);
  }

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
