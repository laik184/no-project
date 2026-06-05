/**
 * server/services/console/runtime-service.ts
 *
 * Handles runtime lifecycle: start, stop, restart, state transitions.
 * Imports console internals ONLY through server/console/index.ts (public API).
 */

import {
  consoleRuntimeManager,
  crashRecovery,
} from '../../console/index.ts';
import { logService } from './log-service.ts';
import type { RuntimeState, RuntimeEntry } from '../../shared/console/types.ts';

export interface StartRuntimeOptions {
  command: string;
  args?:   string[];
  cwd?:    string;
  env?:    Record<string, string>;
}

export const runtimeService = {
  start(projectId: number, opts: StartRuntimeOptions): void {
    consoleRuntimeManager.start(projectId, opts);
    logService.system(projectId, 'Runtime starting…');
  },

  stop(projectId: number): void {
    consoleRuntimeManager.stop(projectId);
    logService.system(projectId, 'Runtime stopped');
  },

  restart(projectId: number, opts: StartRuntimeOptions): void {
    consoleRuntimeManager.restart(projectId, opts);
    logService.system(projectId, 'Runtime restarting…');
  },

  setState(projectId: number, state: RuntimeState, message: string): void {
    consoleRuntimeManager.setState(projectId, state, message);
  },

  markRecovered(projectId: number): void {
    crashRecovery.markRecovered(projectId);
    logService.system(projectId, 'Runtime recovered successfully');
  },

  getState(projectId: number): RuntimeEntry | undefined {
    return consoleRuntimeManager.getState(projectId);
  },

  getAllStates(): RuntimeEntry[] {
    return consoleRuntimeManager.getAllStates();
  },

  isActive(projectId: number): boolean {
    const entry = consoleRuntimeManager.getState(projectId);
    if (!entry) return false;
    return !['idle', 'failed', 'crashed'].includes(entry.state);
  },
};
