import { runtimeMonitor }   from './runtime-monitor.ts';
import { resourceMonitor }  from './resource-monitor.ts';
import { failureMonitor }   from './failure-monitor.ts';
import { runtimeLogger }    from '../telemetry/runtime-logger.ts';

export type AlertLevel = 'info' | 'warn' | 'critical';

export interface RuntimeAlert {
  level:     AlertLevel;
  runId?:    string;
  message:   string;
  timestamp: Date;
}

const alerts: RuntimeAlert[] = [];
const MAX_ALERTS = 100;

function push(alert: RuntimeAlert): void {
  if (alerts.length >= MAX_ALERTS) alerts.shift();
  alerts.push(alert);
  const log = alert.level === 'critical' ? 'error' : alert.level;
  runtimeLogger[log](alert.runId ?? 'system', `[alert] ${alert.message}`);
}

export const runtimeAlerts = {
  checkRun(runId: string): RuntimeAlert[] {
    const issued: RuntimeAlert[] = [];

    if (!runtimeMonitor.isHealthy(runId)) {
      const a: RuntimeAlert = { level: 'critical', runId, message: 'Run failure rate exceeds 50%', timestamp: new Date() };
      push(a); issued.push(a);
    }

    if (failureMonitor.isRunFailing(runId)) {
      const a: RuntimeAlert = { level: 'warn', runId, message: 'Repeated execution failures detected', timestamp: new Date() };
      push(a); issued.push(a);
    }

    return issued;
  },

  checkSystem(): RuntimeAlert[] {
    const issued: RuntimeAlert[] = [];

    if (!resourceMonitor.isMemoryOk()) {
      const a: RuntimeAlert = { level: 'warn', message: 'Memory usage exceeds threshold', timestamp: new Date() };
      push(a); issued.push(a);
    }

    if (!resourceMonitor.isProcessCountOk()) {
      const a: RuntimeAlert = { level: 'warn', message: 'Too many active processes', timestamp: new Date() };
      push(a); issued.push(a);
    }

    return issued;
  },

  getRecent(n = 20): RuntimeAlert[] {
    return alerts.slice(-n);
  },
};
