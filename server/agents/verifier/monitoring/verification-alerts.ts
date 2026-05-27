import { verifierLogger } from '../telemetry/verifier-logger.ts';
import type { VerificationPhase } from '../types/verifier.types.ts';

export type AlertLevel = 'info' | 'warning' | 'critical';

export interface VerificationAlert {
  level:     AlertLevel;
  phase?:    VerificationPhase;
  message:   string;
  timestamp: Date;
  runId:     string;
}

const alerts = new Map<string, VerificationAlert[]>();

function getAlerts(runId: string): VerificationAlert[] {
  if (!alerts.has(runId)) alerts.set(runId, []);
  return alerts.get(runId)!;
}

export const verificationAlerts = {
  raise(
    runId:   string,
    level:   AlertLevel,
    message: string,
    phase?:  VerificationPhase,
  ): void {
    const alert: VerificationAlert = { level, phase, message, timestamp: new Date(), runId };
    getAlerts(runId).push(alert);

    if (level === 'critical') {
      verifierLogger.error(runId, `[alert:critical] ${message}`, { phase });
    } else if (level === 'warning') {
      verifierLogger.warn(runId, `[alert:warning] ${message}`, { phase });
    } else {
      verifierLogger.info(runId, `[alert:info] ${message}`, { phase });
    }
  },

  getCritical(runId: string): VerificationAlert[] {
    return getAlerts(runId).filter((a) => a.level === 'critical');
  },

  getAll(runId: string): VerificationAlert[] {
    return [...getAlerts(runId)];
  },

  hasCritical(runId: string): boolean {
    return getAlerts(runId).some((a) => a.level === 'critical');
  },

  clear(runId: string): void {
    alerts.delete(runId);
  },
};
