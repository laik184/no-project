/**
 * server/agents/browser/core/browser-context.ts
 *
 * Per-run coordination context for the browser agent.
 * Holds the current goal, status, and step results for an agent run.
 * Orchestration layers read/write here; telemetry reads here.
 */

export type BrowserAgentStatus =
  | 'idle'
  | 'planning'
  | 'executing'
  | 'capturing'
  | 'validating'
  | 'retrying'
  | 'completed'
  | 'failed';

export interface BrowserStepRecord {
  stepId:    string;
  tool:      string;
  ok:        boolean;
  durationMs: number;
  error?:    string;
  ts:        string;
}

export interface BrowserAgentContext {
  runId:       string;
  projectId:   string;
  goal:        string;
  url:         string;
  status:      BrowserAgentStatus;
  steps:       BrowserStepRecord[];
  startedAt:   Date;
  updatedAt:   Date;
  error?:      string;
}

// ── Internal store ────────────────────────────────────────────────────────────

const _contexts = new Map<string, BrowserAgentContext>();

// ── Lifecycle ─────────────────────────────────────────────────────────────────

export function createContext(
  runId:     string,
  projectId: string,
  goal:      string,
  url:       string,
): BrowserAgentContext {
  const ctx: BrowserAgentContext = {
    runId,
    projectId,
    goal,
    url,
    status:    'idle',
    steps:     [],
    startedAt: new Date(),
    updatedAt: new Date(),
  };
  _contexts.set(runId, ctx);
  return ctx;
}

export function getContext(runId: string): BrowserAgentContext | undefined {
  return _contexts.get(runId);
}

export function setStatus(runId: string, status: BrowserAgentStatus): void {
  const ctx = _contexts.get(runId);
  if (!ctx) return;
  _contexts.set(runId, { ...ctx, status, updatedAt: new Date() });
}

export function recordStep(runId: string, step: BrowserStepRecord): void {
  const ctx = _contexts.get(runId);
  if (!ctx) return;
  _contexts.set(runId, {
    ...ctx,
    steps:     [...ctx.steps, step],
    updatedAt: new Date(),
  });
}

export function finalizeContext(
  runId:  string,
  ok:     boolean,
  error?: string,
): void {
  const ctx = _contexts.get(runId);
  if (!ctx) return;
  _contexts.set(runId, {
    ...ctx,
    status:    ok ? 'completed' : 'failed',
    error,
    updatedAt: new Date(),
  });
}

export function removeContext(runId: string): void {
  _contexts.delete(runId);
}
