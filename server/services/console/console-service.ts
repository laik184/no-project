/**
 * server/services/console/console-service.ts
 *
 * Top-level coordinator for the console domain.
 * Routes controller calls to the correct sub-service.
 * Enforces: Controller → ConsoleService → {LogService | RuntimeService | ProcessService}
 */

import { logService }     from './log-service.ts';
import { runtimeService } from './runtime-service.ts';
import { processService } from './process-service.ts';
import { sessionRepository } from '../../repositories/console/index.ts';
import { initStreamBroker, streamBrokerStats } from '../../console/streaming/stream-broker.ts';
import { consoleRuntimeManager } from '../../console/runtime/runtime-manager.ts';
import type { LogLine, RuntimeEntry, RuntimeState, ConsoleSession } from '../../console/types/index.ts';

export const consoleService = {
  /**
   * Bootstrap all console subsystems.
   * Call once at application startup.
   */
  init(): void {
    initStreamBroker();
    consoleRuntimeManager.init();
  },

  // ── Session management ─────────────────────────────────────────────────────

  /** Create a new SSE session for a project. Used by the controller. */
  createSession(projectId: number): ConsoleSession {
    return sessionRepository.create(projectId);
  },

  // ── Log operations ─────────────────────────────────────────────────────────

  ingest(projectId: number, raw: string, stream: 'stdout' | 'stderr'): void {
    logService.ingest(projectId, raw, stream);
  },

  systemLog(projectId: number, text: string): void {
    logService.system(projectId, text);
  },

  async getRecentLogs(projectId: number, limit?: number): Promise<LogLine[]> {
    return logService.getRecent(projectId, limit);
  },

  async pruneOldLogs(projectId: number, before: Date): Promise<number> {
    return logService.pruneOld(projectId, before);
  },

  // ── Runtime operations ─────────────────────────────────────────────────────

  startRuntime(
    projectId: number,
    opts: { command: string; args?: string[]; cwd?: string; env?: Record<string, string> },
  ): void {
    runtimeService.start(projectId, opts);
  },

  stopRuntime(projectId: number): void {
    runtimeService.stop(projectId);
  },

  restartRuntime(
    projectId: number,
    opts: { command: string; args?: string[]; cwd?: string; env?: Record<string, string> },
  ): void {
    runtimeService.restart(projectId, opts);
  },

  setRuntimeState(projectId: number, state: RuntimeState, message: string): void {
    runtimeService.setState(projectId, state, message);
  },

  markRecovered(projectId: number): void {
    runtimeService.markRecovered(projectId);
  },

  getRuntimeState(projectId: number): RuntimeEntry | undefined {
    return runtimeService.getState(projectId);
  },

  // ── Process operations ─────────────────────────────────────────────────────

  stopProcess(projectId: number): void {
    processService.stop(projectId);
  },

  isProcessRunning(projectId: number): boolean {
    return processService.isRunning(projectId);
  },

  // ── Session / stream info ──────────────────────────────────────────────────

  getSessionCount(projectId: number): number {
    return sessionRepository.countOpen(projectId);
  },

  getStreamStats() {
    return streamBrokerStats();
  },
};
