/**
 * action-logger.ts
 * ONLY responsible for logging browser actions to the run action trace.
 */

import { actionTrace }    from '../../../agents/browser/telemetry/action-trace.ts';
import { browserLogger }  from '../../../agents/browser/telemetry/browser-logger.ts';

export interface LoggedAction {
  runId:     string;
  action:    string;
  target?:   string;
  value?:    string;
  success:   boolean;
  durationMs: number;
}

export function logAction(entry: LoggedAction): void {
  actionTrace.record(entry.runId, {
    action:     entry.action,
    target:     entry.target,
    value:      entry.value,
    success:    entry.success,
    durationMs: entry.durationMs,
  });

  if (entry.success) {
    browserLogger.debug(entry.runId, `Action OK: ${entry.action}`, {
      target:     entry.target,
      durationMs: entry.durationMs,
    });
  } else {
    browserLogger.warn(entry.runId, `Action failed: ${entry.action}`, {
      target: entry.target,
    });
  }
}

export function logNavigationAction(
  runId:      string,
  url:        string,
  success:    boolean,
  durationMs: number,
): void {
  logAction({ runId, action: 'navigate', target: url, success, durationMs });
}

export function logInteractionAction(
  runId:      string,
  action:     string,
  selector:   string,
  success:    boolean,
  durationMs: number,
  value?:     string,
): void {
  logAction({ runId, action, target: selector, value, success, durationMs });
}

export function getActionLog(runId: string) {
  return actionTrace.getAll(runId);
}

export function getFailedActions(runId: string) {
  return actionTrace.getFailures(runId);
}
