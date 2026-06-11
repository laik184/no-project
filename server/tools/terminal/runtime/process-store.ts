/**
 * server/tools/terminal/runtime/process-store.ts
 *
 * In-process registry of running child processes, keyed by projectId.
 * Shared between runtime tools (start/stop/restart) and process tools (list/kill/logs).
 */

import type { ChildProcess } from 'child_process';

export interface ProcessRecord {
  pid:        number;
  command:    string;
  projectId:  number;
  startedAt:  number;
  process:    ChildProcess;
  logs:       string[];
}

const store = new Map<number, ProcessRecord>();

export function setProcess(projectId: number, record: ProcessRecord): void {
  store.set(projectId, record);
}

export function getProcess(projectId: number): ProcessRecord | undefined {
  return store.get(projectId);
}

export function deleteProcess(projectId: number): boolean {
  return store.delete(projectId);
}

export function listProcesses(): ProcessRecord[] {
  return [...store.values()];
}

export function appendLog(projectId: number, line: string): void {
  const rec = store.get(projectId);
  if (!rec) return;
  rec.logs.push(line);
  if (rec.logs.length > 500) rec.logs.splice(0, rec.logs.length - 500);
}

export function isRunning(projectId: number): boolean {
  const rec = store.get(projectId);
  if (!rec) return false;
  if (!rec.pid || rec.pid <= 0) return false;
  try { process.kill(rec.pid, 0); return true; } catch { return false; }
}
