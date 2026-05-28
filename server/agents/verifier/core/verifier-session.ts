/**
 * core/verifier-session.ts
 * Manages the lifecycle of a single verification session.
 */

import type { VerificationInput, VerificationStatus, PhaseResult } from '../types/verifier.types.ts';
import { verificationStore } from '../state/verification-store.ts';
import { workflowStore }     from '../state/workflow-store.ts';
import { executionHistory }  from '../state/execution-history.ts';
import { performanceTracker } from '../telemetry/performance-tracker.ts';
import { executionTrace }    from '../telemetry/execution-trace.ts';
import { verifierMetrics }   from '../telemetry/verifier-metrics.ts';
import { failureMonitor }    from '../monitoring/failure-monitor.ts';
import { healthMonitor }     from '../monitoring/health-monitor.ts';
import { clearRetries }      from '../recovery/retry-recovery.ts';

export interface VerificationSession {
  runId:      string;
  projectId:  string;
  status:     VerificationStatus;
  startedAt:  Date;
  phases:     PhaseResult[];
}

export function openSession(input: VerificationInput): VerificationSession {
  const record = verificationStore.create(input);
  verificationStore.setStatus(input.runId, 'running');
  healthMonitor.trackRun(input.runId, 'running');

  return {
    runId:     input.runId,
    projectId: input.projectId,
    status:    'running',
    startedAt: record.startedAt,
    phases:    [],
  };
}

export function closeSession(runId: string, status: VerificationStatus): void {
  verificationStore.setStatus(runId, status);
  healthMonitor.trackRun(runId, status);
}

export function cleanupSession(runId: string): void {
  performanceTracker.clear(runId);
  executionTrace.clear(runId);
  verifierMetrics.clear(runId);
  failureMonitor.clear(runId);
  healthMonitor.clearRun(runId);
  workflowStore.clearRun(runId);
  executionHistory.clear(runId);
  clearRetries(runId);
}

export function getSessionStatus(runId: string): VerificationStatus | undefined {
  return verificationStore.get(runId)?.status;
}

export function isSessionActive(runId: string): boolean {
  const status = getSessionStatus(runId);
  return status === 'running' || status === 'pending';
}
