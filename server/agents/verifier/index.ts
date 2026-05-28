/**
 * server/agents/verifier/index.ts
 * Public exports for the Verifier orchestration agent.
 */

// ── Agent ─────────────────────────────────────────────────────────────────────
export { VerifierAgent, verifierAgent } from './verifier-agent.ts';

// ── Core types ────────────────────────────────────────────────────────────────
export type {
  VerificationInput,
  VerificationResult,
  VerificationPhase,
  VerificationStatus,
  PhaseResult,
  VerificationConfig,
  EndpointSpec,
} from './types/verifier.types.ts';

export type {
  WorkflowKind,
  WorkflowInput,
  WorkflowResult,
} from './types/workflow.types.ts';

export type {
  ExecutionStep,
  StepResult,
  ExecutionSummary,
} from './types/execution.types.ts';

export type {
  ParsedError,
  RootCause,
  DiagnosticsReport,
  FailureSummary,
} from './types/diagnostics.types.ts';

// ── Orchestrator (for advanced callers) ───────────────────────────────────────
export {
  VerificationOrchestrator,
  verificationOrchestrator,
} from './orchestration/verification-orchestrator.ts';

// ── Compat shims for orchestration/pipeline callers ───────────────────────────

/**
 * No-op initializer — verifier is lazily initialized on first use.
 * Provided for backwards compatibility with verification-phase.ts.
 */
export function initializeVerifier(): void {
  // no-op: the verifier agent is lazily initialized on first call
}

/**
 * Convenience wrapper — runs a verification and returns a simplified result.
 * Provided for backwards compatibility with verification-phase.ts.
 */
export async function runVerification(input: {
  runId:      string;
  projectId:  string;
  phases:     import('./types/verifier.types.ts').VerificationPhase[];
  timeoutMs?: number;
  sandboxRoot?: string;
}): Promise<{
  ok:         boolean;
  phases:     number;
  durationMs: number;
  errors:     string[];
}> {
  const { verifierAgent } = await import('./verifier-agent.ts');
  const result = await verifierAgent.verify({
    runId:       input.runId,
    projectId:   input.projectId,
    phases:      input.phases,
    timeoutMs:   input.timeoutMs,
    sandboxRoot: input.sandboxRoot ?? process.env['AGENT_PROJECT_ROOT'] ?? '.sandbox',
  });
  return {
    ok:         result.overallStatus === 'passed',
    phases:     result.phases.length,
    durationMs: result.durationMs,
    errors:     result.phases.flatMap((p) => p.errors),
  };
}

// ── Monitoring ────────────────────────────────────────────────────────────────
export { healthMonitor } from './monitoring/health-monitor.ts';

// ── Telemetry (if callers want structured access) ─────────────────────────────
export { verifierLogger }  from './telemetry/verifier-logger.ts';
export { verifierMetrics } from './telemetry/verifier-metrics.ts';
