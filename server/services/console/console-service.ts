/**
 * server/services/console/console-service.ts
 *
 * Top-level coordinator for the console domain.
 * Imports console internals ONLY through server/console/index.ts (public API).
 * Enforces: Controller → ConsoleService → {LogService | RuntimeService | ProcessService}
 */

import { logService }     from './log-service.ts';
import { runtimeService } from './runtime-service.ts';
import { processService } from './process-service.ts';
import {
  initStreamBroker,
  streamBrokerStats,
  consoleRuntimeManager,
} from '../../console/index.ts';
import { sessionRepository } from '../../repositories/console/index.ts';
import type { LogLine, RuntimeEntry, RuntimeState, ConsoleSession } from '../../shared/console/types.ts';

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
