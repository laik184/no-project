import type { VerificationPhase, VerificationStatus } from './types.ts';
import { verifierLogger } from './telemetry.ts';

export type AlertLevel = 'info' | 'warning' | 'critical';
export type SystemHealthState = 'healthy' | 'degraded' | 'unhealthy';

export interface VerificationAlert {
  level:     AlertLevel;
  phase?:    VerificationPhase;
  message:   string;
  timestamp: Date;
  runId:     string;
}

export interface SystemHealthSnapshot {
  state:          SystemHealthState;
  activeRuns:     number;
  successRate:    number;
  criticalAlerts: number;
  timestamp:      Date;
}

export interface PhaseProgressEvent {
  runId:      string;
  phase:      VerificationPhase;
  status:     VerificationStatus;
  durationMs: number;
  errors:     string[];
}

interface PhaseMetric {
  phase:      VerificationPhase;
  status:     VerificationStatus;
  durationMs: number;
  recordedAt: Date;
}

const phaseHistory  = new Map<string, PhaseMetric[]>();
const runStatusMap  = new Map<string, VerificationStatus>();
const alertsMap     = new Map<string, VerificationAlert[]>();
const activeRuns    = new Set<string>();
const runStatuses   = new Map<string, VerificationStatus>();

function getHistory(runId: string): PhaseMetric[] {
  if (!phaseHistory.has(runId)) phaseHistory.set(runId, []);
  return phaseHistory.get(runId)!;
}
function getAlerts(runId: string): VerificationAlert[] {
  if (!alertsMap.has(runId)) alertsMap.set(runId, []);
  return alertsMap.get(runId)!;
}

export const verificationMetricsStore = {
  recordPhase(runId: string, phase: VerificationPhase, status: VerificationStatus, durationMs: number): void {
    getHistory(runId).push({ phase, status, durationMs, recordedAt: new Date() });
  },
  setRunStatus(runId: string, status: VerificationStatus): void {
    runStatusMap.set(runId, status);
  },
  getRunStatus(runId: string): VerificationStatus {
    return runStatusMap.get(runId) ?? 'pending';
  },
  getPhaseHistory(runId: string): PhaseMetric[] {
    return [...getHistory(runId)];
  },
  getSuccessRate(runId: string): number {
    const hist = getHistory(runId);
    if (!hist.length) return 0;
    return hist.filter((m) => m.status === 'passed').length / hist.length;
  },
  getTotalDuration(runId: string): number {
    return getHistory(runId).reduce((sum, m) => sum + m.durationMs, 0);
  },
  clear(runId: string): void {
    phaseHistory.delete(runId);
    runStatusMap.delete(runId);
  },
};

export const verificationAlerts = {
  raise(runId: string, level: AlertLevel, message: string, phase?: VerificationPhase): void {
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
    alertsMap.delete(runId);
  },
};

export const healthMonitor = {
  registerRun(runId: string): void {
    activeRuns.add(runId);
    runStatuses.set(runId, 'running');
  },
  completeRun(runId: string, status: VerificationStatus): void {
    activeRuns.delete(runId);
    runStatuses.set(runId, status);
    verificationMetricsStore.setRunStatus(runId, status);
  },
  getSnapshot(): SystemHealthSnapshot {
    const statuses      = Array.from(runStatuses.values());
    const passed        = statuses.filter((s) => s === 'passed').length;
    const successRate   = statuses.length ? passed / statuses.length : 1;
    const criticalCount = Array.from(runStatuses.keys())
      .filter((id) => verificationAlerts.hasCritical(id)).length;
    const state: SystemHealthState =
      criticalCount > 0 ? 'unhealthy'
      : successRate < 0.5 ? 'degraded'
      : 'healthy';
    return { state, activeRuns: activeRuns.size, successRate, criticalAlerts: criticalCount, timestamp: new Date() };
  },
  isHealthy(): boolean {
    return this.getSnapshot().state === 'healthy';
  },
  clearRun(runId: string): void {
    activeRuns.delete(runId);
    runStatuses.delete(runId);
  },
};

export const verificationMonitor = {
  onRunStart(runId: string): void {
    healthMonitor.registerRun(runId);
    verificationMetricsStore.setRunStatus(runId, 'running');
  },
  onPhaseComplete(event: PhaseProgressEvent): void {
    verificationMetricsStore.recordPhase(event.runId, event.phase, event.status, event.durationMs);
    if (event.status === 'failed') {
      verificationAlerts.raise(
        event.runId,
        event.errors.length > 3 ? 'critical' : 'warning',
        `Phase "${event.phase}" failed: ${event.errors.slice(0, 2).join('; ')}`,
        event.phase,
      );
    }
  },
  onRunComplete(runId: string, status: VerificationStatus): void {
    healthMonitor.completeRun(runId, status);
    if (status === 'failed') {
      verificationAlerts.raise(runId, 'critical', 'Verification run failed');
    }
  },
  getSuccessRate(runId: string): number {
    return verificationMetricsStore.getSuccessRate(runId);
  },
  clear(runId: string): void {
    verificationMetricsStore.clear(runId);
    verificationAlerts.clear(runId);
    healthMonitor.clearRun(runId);
  },
};
