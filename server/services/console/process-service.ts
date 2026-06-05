/**
 * server/services/console/process-service.ts
 *
 * Manages child process lifecycle for the console domain.
 * Delegates to ProcessSupervisor for actual spawn logic.
 * Controller → ProcessService → ProcessSupervisor (no direct DB access).
 */

import { spawnSupervised }        from '../../console/runtime/process-supervisor.ts';
import { consoleRuntimeManager }  from '../../console/runtime/runtime-manager.ts';
import { logService }             from './log-service.ts';
import type { SupervisorHandle }  from '../../console/runtime/process-supervisor.ts';

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
  /**
   * Spawn a supervised child process for the given project.
   * Stdout/stderr are piped through the log pipeline automatically.
   */
  start(opts: ProcessStartOptions): ProcessInfo {
    const existing = handles.get(opts.projectId);
    if (existing) {
      existing.stop();
      handles.delete(opts.projectId);
    }

    const spawned  = spawnSupervised(opts);
    const startedAt = Date.now();
    handles.set(opts.projectId, { ...spawned, startedAt });

    logService.system(opts.projectId, `Process started (pid ${spawned.pid ?? '?'})`);

    return { pid: spawned.pid, running: true, startedAt };
  },

  /**
   * Gracefully stop a project's process (SIGTERM).
   */
  stop(projectId: number): void {
    const handle = handles.get(projectId);
    if (!handle) return;
    handle.stop();
    handles.delete(projectId);
    logService.system(projectId, 'Process stopped');
  },

  /**
   * Force-kill a project's process (SIGKILL).
   */
  kill(projectId: number): void {
    const handle = handles.get(projectId);
    if (!handle) return;
    handle.kill();
    handles.delete(projectId);
    logService.system(projectId, 'Process killed');
  },

  /**
   * Check if a project has an active supervised process.
   */
  isRunning(projectId: number): boolean {
    return handles.has(projectId);
  },

  getInfo(projectId: number): ProcessInfo | null {
    const h = handles.get(projectId);
    if (!h) return null;
    return { pid: h.pid, running: true, startedAt: h.startedAt };
  },

  /**
   * Stop all running processes (e.g. on server shutdown).
   */
  stopAll(): void {
    for (const [projectId, handle] of handles) {
      handle.stop();
      handles.delete(projectId);
    }
  },
};
