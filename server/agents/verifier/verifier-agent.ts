/**
 * verifier-agent.ts
 * Public-facing agent class for the Verifier orchestration agent.
 *
 * Contract:
 * - Accepts a VerificationInput
 * - Delegates ALL execution to verificationOrchestrator
 * - Zero direct fs, child_process, Playwright, or tsc calls
 * - Reports results back as VerificationResult
 */

import type { VerificationInput, VerificationResult } from './types/verifier.types.ts';
import { verificationOrchestrator } from './orchestration/verification-orchestrator.ts';
import { verifierLogger }           from './telemetry/verifier-logger.ts';
import { healthMonitor }            from './monitoring/health-monitor.ts';
import { PHASE_ORDER }              from './utils/planning-utils.ts';
import type { VerificationPhase }   from './types/verifier.types.ts';

export type { VerificationInput, VerificationResult };
export type { VerificationPhase };

export class VerifierAgent {
  /** Run a full verification pass for a project. */
  async verify(input: VerificationInput): Promise<VerificationResult> {
    verifierLogger.info(input.runId, 'VerifierAgent.verify called', {
      projectId:   input.projectId,
      phases:      input.phases,
      sandboxRoot: input.sandboxRoot,
    });

    return verificationOrchestrator.run(input);
  }

  /**
   * Run a quick sanity-check verification (typecheck + build only).
   * Useful after code generation before a full run.
   */
  async quickVerify(
    runId:       string,
    projectId:   string,
    sandboxRoot: string,
  ): Promise<VerificationResult> {
    const input: VerificationInput = {
      runId,
      projectId,
      sandboxRoot,
      phases:     ['typecheck', 'build'],
      timeoutMs:  180_000,
    };
    return this.verify(input);
  }

  /**
   * Run a full verification pass with all phases.
   */
  async fullVerify(
    runId:       string,
    projectId:   string,
    sandboxRoot: string,
    port?:       number,
  ): Promise<VerificationResult> {
    const input: VerificationInput = {
      runId,
      projectId,
      sandboxRoot,
      phases:    [...PHASE_ORDER] as VerificationPhase[],
      timeoutMs: 600_000,
      port,
    };
    return this.verify(input);
  }

  /** Report whether the verifier subsystem is healthy. */
  async healthCheck(): Promise<{ healthy: boolean; status: string }> {
    const snapshot = healthMonitor.snapshot();
    return {
      healthy: snapshot.state === 'healthy',
      status:  `${snapshot.state} — active: ${snapshot.activeRuns}, successRate: ${(snapshot.successRate * 100).toFixed(0)}%`,
    };
  }

  /** Cleanup resources after a run (call after consuming the result). */
  async cleanup(runId: string): Promise<void> {
    await verificationOrchestrator.cleanup(runId);
  }
}

export const verifierAgent = new VerifierAgent();
