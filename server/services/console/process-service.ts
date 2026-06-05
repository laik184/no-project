/**
 * server/services/console/process-service.ts
 *
 * Manages child process lifecycle for the console domain.
 * Imports console internals ONLY through server/console/index.ts (public API).
 */

import {
  spawnSupervised,
  consoleRuntimeManager,
} from '../../console/index.ts';
import { logService } from './log-service.ts';
import type { SupervisorHandle } from '../../console/index.ts';

export interface ProcessStartOptions {
  projectId: number;
  command:   string;
  args?:     string[];
  cwd?:      string;
  env?:      Record<string, string>;
}

export interface ProcessInfo {
  pid?:      number;
  running:   boolean;
  startedAt: number;
}

const handles = new Map<number, SupervisorHandle & { startedAt: number }>();

export const processService = {
  start(opts: ProcessStartOptions): ProcessInfo {
    const existing = handles.get(opts.projectId);
    if (existing) {
      existing.stop();
      handles.delete(opts.projectId);
    }

    const spawned   = spawnSupervised(opts);
    const startedAt = Date.now();
    handles.set(opts.projectId, { ...spawned, startedAt });

    logService.system(opts.projectId, `Process started (pid ${spawned.pid ?? '?'})`);

    return { pid: spawned.pid, running: true, startedAt };
  },

  stop(projectId: number): void {
    const handle = handles.get(projectId);
    if (!handle) return;
    handle.stop();
    handles.delete(projectId);
    logService.system(projectId, 'Process stopped');
  },

  kill(projectId: number): void {
    const handle = handles.get(projectId);
    if (!handle) return;
    handle.kill();
    handles.delete(projectId);
    logService.system(projectId, 'Process killed');
  },

  isRunning(projectId: number): boolean {
    return handles.has(projectId);
  },

  getInfo(projectId: number): ProcessInfo | null {
    const h = handles.get(projectId);
    if (!h) return null;
    return { pid: h.pid, running: true, startedAt: h.startedAt };
  },

  stopAll(): void {
    for (const [projectId, handle] of handles) {
      handle.stop();
      handles.delete(projectId);
    }
  },
};
