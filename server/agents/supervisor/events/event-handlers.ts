/**
 * event-handlers.ts — Supervisor event listeners.
 *
 * Kept metrics: loop.detected, runs.started, runs.completed, runs.failed,
 *               phase.duration, retry.count
 */

import { supervisorBus } from './supervisor-events.ts';
import { supervisorLogger } from '../telemetry/supervisor-logger.ts';
import { supervisorMetrics } from '../telemetry/supervisor-metrics.ts';

let _registered = false;

export function registerSupervisorHandlers(): void {
  if (_registered) return;
  _registered = true;

  supervisorBus.on('supervisor.started', (p) => {
    supervisorLogger.info(p.runId, `[supervisor] Session ${p.sessionId} started — mode=${p.mode} category=${p.category}`);
    supervisorMetrics.increment(p.runId, 'runs.started');
  });

  supervisorBus.on('supervisor.cycle.started', (p) => {
    supervisorLogger.info(p.runId, `[supervisor] Phase "${p.phase}" started`);
  });

  supervisorBus.on('supervisor.cycle.completed', (p) => {
    supervisorLogger.info(p.runId, `[supervisor] Phase "${p.phase}" completed — ${p.durationMs}ms`);
    supervisorMetrics.timing(p.runId, 'phase.duration', p.durationMs);
    supervisorMetrics.increment(p.runId, 'runs.completed');
  });

  supervisorBus.on('supervisor.cycle.failed', (p) => {
    supervisorLogger.warn(p.runId, `[supervisor] Phase "${p.phase}" failed — ${p.durationMs}ms retries=${p.retries}`);
    supervisorMetrics.increment(p.runId, 'runs.failed');
    supervisorMetrics.increment(p.runId, 'retry.count', p.retries);
  });

  supervisorBus.on('supervisor.loop.detected', (p) => {
    supervisorLogger.warn(p.runId, `[supervisor] Loop detected — risk=${p.risk} pattern="${p.pattern}" occurrences=${p.occurrences}`);
    supervisorMetrics.increment(p.runId, 'loop.detected');
  });

  supervisorBus.on('supervisor.shutdown', (p) => {
    supervisorLogger.info('system', `[supervisor] Shutdown — activeSessions=${p.activeSessions} status=${p.status}`);
  });
}

export function unregisterSupervisorHandlers(): void {
  supervisorBus.removeAllListeners();
  _registered = false;
}
