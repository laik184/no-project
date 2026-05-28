/**
 * monitoring/failure-monitor.ts
 * Monitors and classifies verification failures for alerting.
 */

import type { VerificationPhase } from '../types/verifier.types.ts';
import { verifierLogger }  from '../telemetry/verifier-logger.ts';
import { verifierMetrics } from '../telemetry/verifier-metrics.ts';

export type AlertLevel = 'info' | 'warning' | 'critical';

export interface FailureAlert {
  runId:     string;
  level:     AlertLevel;
  phase?:    VerificationPhase;
  message:   string;
  errors:    string[];
  timestamp: Date;
}

const alerts = new Map<string, FailureAlert[]>();

function getAlerts(runId: string): FailureAlert[] {
  if (!alerts.has(runId)) alerts.set(runId, []);
  return alerts.get(runId)!;
}

export const failureMonitor = {
  reportFailure(
    runId:   string,
    errors:  string[],
    phase?:  VerificationPhase,
  ): FailureAlert {
    const level: AlertLevel = errors.length > 5 ? 'critical' : errors.length > 2 ? 'warning' : 'info';
    const message = phase
      ? `Phase "${phase}" failed with ${errors.length} error(s)`
      : `Verification failed with ${errors.length} error(s)`;

    const alert: FailureAlert = { runId, level, phase, message, errors, timestamp: new Date() };
    getAlerts(runId).push(alert);
    verifierMetrics.increment(runId, `failures.${level}`);

    if (level === 'critical') {
      verifierLogger.error(runId, `[failure-monitor] CRITICAL: ${message}`, { errors: errors.slice(0, 3) });
    } else if (level === 'warning') {
      verifierLogger.warn(runId, `[failure-monitor] WARNING: ${message}`);
    }

    return alert;
  },

  hasCritical(runId: string): boolean {
    return getAlerts(runId).some((a) => a.level === 'critical');
  },

  getAll(runId: string): FailureAlert[] {
    return [...getAlerts(runId)];
  },

  getCritical(runId: string): FailureAlert[] {
    return getAlerts(runId).filter((a) => a.level === 'critical');
  },

  clear(runId: string): void {
    alerts.delete(runId);
  },
};
