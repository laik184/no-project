import { supervisorBus } from './supervisor-events.ts';
import { supervisorLogger } from '../telemetry/supervisor-logger.ts';
import { supervisorMetrics } from '../telemetry/supervisor-metrics.ts';

let _registered = false;

export function registerSupervisorHandlers(): void {
  if (_registered) return;
  _registered = true;

  supervisorBus.on('supervisor.started', (p) => {
    supervisorLogger.info(p.runId, `[supervisor] Session ${p.sessionId} started — mode=${p.mode} category=${p.category}`);
    supervisorMetrics.increment(p.runId, 'supervisor.sessions.started');
  });

  supervisorBus.on('supervisor.cycle.started', (p) => {
    supervisorLogger.info(p.runId, `[supervisor] Cycle started — phase=${p.phase}`);
  });

  supervisorBus.on('supervisor.cycle.completed', (p) => {
    supervisorLogger.info(p.runId, `[supervisor] Cycle completed — phase=${p.phase} duration=${p.durationMs}ms retries=${p.retries}`);
    supervisorMetrics.increment(p.runId, 'supervisor.cycles.completed');
    supervisorMetrics.timing(p.runId, `supervisor.cycle.${p.phase}`, p.durationMs);
  });

  supervisorBus.on('supervisor.cycle.failed', (p) => {
    supervisorLogger.warn(p.runId, `[supervisor] Cycle failed — phase=${p.phase} duration=${p.durationMs}ms retries=${p.retries}`);
    supervisorMetrics.increment(p.runId, 'supervisor.cycles.failed');
  });

  supervisorBus.on('supervisor.decision.made', (p) => {
    supervisorLogger.info(p.runId, `[supervisor] Decision: ${p.action} — ${p.reason}`);
    supervisorMetrics.increment(p.runId, `supervisor.decision.${p.action}`);
  });

  supervisorBus.on('supervisor.loop.detected', (p) => {
    supervisorLogger.warn(p.runId, `[supervisor] Loop detected — risk=${p.risk} pattern="${p.pattern}" occurrences=${p.occurrences}`);
    supervisorMetrics.increment(p.runId, 'supervisor.loops.detected');
  });

  supervisorBus.on('supervisor.escalated', (p) => {
    supervisorLogger.error(p.runId, `[supervisor] Escalated — reason=${p.reason} phase=${p.phase} retries=${p.retryCount}`);
    supervisorMetrics.increment(p.runId, 'supervisor.escalations');
  });

  supervisorBus.on('supervisor.shutdown', (p) => {
    supervisorLogger.info('system', `[supervisor] Shutdown — activeSessions=${p.activeSessions} status=${p.status}`);
    supervisorMetrics.increment('system', 'supervisor.shutdowns');
  });
}

export function unregisterSupervisorHandlers(): void {
  supervisorBus.removeAllListeners();
  _registered = false;
}
