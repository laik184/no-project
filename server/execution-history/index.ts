/**
 * server/execution-history/index.ts
 *
 * Persistent tool execution history system.
 * Tracks all tool invocations across agent runs for auditing and replay.
 */

import { Router, type Request, type Response } from 'express';

interface HistoryEntry {
  id:         string;
  runId:      string;
  projectId?: number;
  tool:       string;
  input:      unknown;
  output?:    unknown;
  error?:     string;
  success:    boolean;
  durationMs: number;
  createdAt:  Date;
}

const store = new Map<string, HistoryEntry[]>();
const MAX_PER_RUN = 1_000;

let initialized = false;

export function initExecutionHistory(): void {
  if (initialized) return;
  initialized = true;
  console.log('[execution-history] Persistent tool execution history initialized');
}

export const executionHistoryStore = {
  record(entry: Omit<HistoryEntry, 'id' | 'createdAt'>): void {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const full: HistoryEntry = { ...entry, id, createdAt: new Date() };
    if (!store.has(entry.runId)) store.set(entry.runId, []);
    const list = store.get(entry.runId)!;
    if (list.length >= MAX_PER_RUN) list.shift();
    list.push(full);
  },

  getByRun(runId: string): HistoryEntry[] {
    return [...(store.get(runId) ?? [])];
  },

  clearRun(runId: string): void {
    store.delete(runId);
  },

  summary(runId: string): { total: number; passed: number; failed: number } {
    const entries = store.get(runId) ?? [];
    const passed  = entries.filter((e) => e.success).length;
    return { total: entries.length, passed, failed: entries.length - passed };
  },
};

export function createExecutionHistoryRouter(): Router {
  const router = Router();

  router.get('/runs/:runId', (req: Request, res: Response) => {
    const entries = executionHistoryStore.getByRun(req.params.runId);
    res.json({ ok: true, runId: req.params.runId, count: entries.length, entries });
  });

  router.get('/runs/:runId/summary', (req: Request, res: Response) => {
    const summary = executionHistoryStore.summary(req.params.runId);
    res.json({ ok: true, runId: req.params.runId, ...summary });
  });

  router.delete('/runs/:runId', (req: Request, res: Response) => {
    executionHistoryStore.clearRun(req.params.runId);
    res.json({ ok: true, cleared: req.params.runId });
  });

  return router;
}
