/**
 * server/tools/terminal/state/process-manager.ts
 *
 * In-process registry for tracked child processes.
 * State store only — no process spawning here.
 */

import { randomUUID } from 'crypto';

export interface ProcessRecord {
  id:        string;
  runId:     string;
  projectId: string;
  command:   string;
  pid:       number;
  status:    'running' | 'stopped' | 'crashed' | 'killed';
  startedAt: Date;
  exitCode?: number;
}

const MAX_RECORDS = 500;
const store  = new Map<string, ProcessRecord>();
const byRun  = new Map<string, Set<string>>();

function track(runId: string, id: string): void {
  if (!byRun.has(runId)) byRun.set(runId, new Set());
  byRun.get(runId)!.add(id);
}

export const processManager = {
  register(runId: string, command: string, pid: number, projectId = 'unknown'): ProcessRecord {
    const id = randomUUID().replace(/-/g, '').slice(0, 12);
    const record: ProcessRecord = { id, runId, projectId, command, pid, status: 'running', startedAt: new Date() };
    if (store.size >= MAX_RECORDS) {
      const firstKey = store.keys().next().value;
      if (firstKey) store.delete(firstKey);
    }
    store.set(id, record);
    track(runId, id);
    return record;
  },

  markStopped(id: string, exitCode: number): void {
    const r = store.get(id);
    if (!r) return;
    r.status = exitCode === 0 ? 'stopped' : 'crashed';
    r.exitCode = exitCode;
  },

  markKilled(id: string): void {
    const r = store.get(id);
    if (r) r.status = 'killed';
  },

  getById(id: string): ProcessRecord | undefined { return store.get(id); },

  getByPid(pid: number): ProcessRecord | undefined {
    return [...store.values()].find((r) => r.pid === pid);
  },

  getForRun(runId: string): readonly ProcessRecord[] {
    const ids = byRun.get(runId);
    if (!ids) return Object.freeze([]);
    return Object.freeze([...ids].map((id) => store.get(id)).filter(Boolean) as ProcessRecord[]);
  },

  clearRun(runId: string): void {
    const ids = byRun.get(runId);
    if (ids) { for (const id of ids) store.delete(id); byRun.delete(runId); }
  },
};
