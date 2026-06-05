/**
 * server/services/console/runtime-service.ts
 *
 * Handles runtime lifecycle: start, stop, restart, state transitions.
 * Controller → RuntimeService → consoleRuntimeManager → runtimeRepository
 */

import { consoleRuntimeManager }  from '../../console/runtime/runtime-manager.ts';
import { crashRecovery }          from '../../console/runtime/crash-recovery.ts';
import { runtimeRepository }      from '../../repositories/console/runtime-repository.ts';
import { logService }             from './log-service.ts';
import type { RuntimeState, RuntimeEntry } from '../../console/types/index.ts';

export interface StartRuntimeOptions {
  command: string;
  args?:   string[];
  cwd?:    string;
  env?:    Record<string, string>;
}

export const runtimeService = {
  /**
   * Start the runtime for a project.
   * Drives state: idle → starting → ready
   */
  start(projectId: number, opts: StartRuntimeOptions): void {
    consoleRuntimeManager.start(projectId, opts);
    logService.system(projectId, 'Runtime starting…');
  },

  /**
   * Stop the runtime for a project.
   */
  stop(projectId: number): void {
    consoleRuntimeManager.stop(projectId);
    logService.system(projectId, 'Runtime stopped');
  },

  /**
   * Restart the runtime for a project.
   * Drives state: current → restarting → starting → ready
   */
  restart(projectId: number, opts: StartRuntimeOptions): void {
    consoleRuntimeManager.restart(projectId, opts);
    logService.system(projectId, 'Runtime restarting…');
  },

  /**
   * Manually set the runtime state (e.g. from an agent action).
   */
  setState(projectId: number, state: RuntimeState, message: string): void {
    consoleRuntimeManager.setState(projectId, state, message);
  },

  /**
   * Mark a crashed project as recovered.
   */
  markRecovered(projectId: number): void {
    crashRecovery.markRecovered(projectId);
    logService.system(projectId, 'Runtime recovered successfully');
  },

  /**
   * Get the current runtime state for a project.
   */
  getState(projectId: number): RuntimeEntry | undefined {
    return runtimeRepository.getState(projectId);
  },

  /**
   * Get states for all known projects.
   */
  getAllStates(): RuntimeEntry[] {
    return runtimeRepository.all();
  },

  /**
   * Check if the runtime is active (non-idle, non-failed, non-crashed).
   */
  isActive(projectId: number): boolean {
    const entry = runtimeRepository.getState(projectId);
    if (!entry) return false;
    return !['idle', 'failed', 'crashed'].includes(entry.state);
  },
};
