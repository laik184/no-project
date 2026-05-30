/**
 * server/agents/executor/memory/execution-history.ts
 *
 * Cross-run execution intelligence. Persists successful/failed fix patterns,
 * retry outcomes, validation failures, and tool failure traces so future runs
 * can make smarter decisions. Bounded ring-buffer — last MAX_RUNS entries.
 *
 * No execution logic. No tool imports.
 */

import type { TaskKind } from '../types/executor.types.ts';
import { memoryEngine } from '../../../memory/index.ts';

// ── Entry types ───────────────────────────────────────────────────────────────

export type HistoryOutcome = 'success' | 'failure' | 'partial';

export interface ExecutionHistoryEntry {
  readonly id:          string;
  readonly runId:       string;
  readonly taskId:      string;
  readonly toolName:    string;
  readonly kind:        TaskKind;
  readonly outcome:     HistoryOutcome;
  readonly errorText?:  string;
  readonly retries:     number;
  readonly durationMs:  number;
  readonly errorClass?: string;
  readonly fixApplied?: string;
  readonly ts:          number;
}

export interface ExecutionHistorySummary {
  totalRecorded:  number;
  successRate:    number;
  avgRetries:     number;
  topFailures:    Array<{ errorClass: string; count: number }>;
  topSuccessTools: Array<{ toolName: string; count: number }>;
}

// ── Store ─────────────────────────────────────────────────────────────────────

const MAX_RUNS      = 200;
const _history: ExecutionHistoryEntry[] = [];
let   _seq = 0;

function _classifyError(errorText: string): string {
  if (/timeout/i.test(errorText))           return 'TIMEOUT';
  if (/permission|denied/i.test(errorText)) return 'PERMISSION';
  if (/not found|enoent/i.test(errorText))  return 'NOT_FOUND';
  if (/syntax|parse/i.test(errorText))      return 'SYNTAX';
  if (/network|econnreset|fetch/i.test(errorText)) return 'NETWORK';
  if (/type.*error/i.test(errorText))       return 'TYPE_ERROR';
  if (/import|module/i.test(errorText))     return 'MODULE';
  if (/validation/i.test(errorText))        return 'VALIDATION';
  return 'UNKNOWN';
}

// ── API ───────────────────────────────────────────────────────────────────────

export const executionHistory = {
  recordExecution(params: {
    runId:       string;
    taskId:      string;
    toolName:    string;
    kind:        TaskKind;
    outcome:     HistoryOutcome;
    errorText?:  string;
    retries:     number;
    durationMs:  number;
    fixApplied?: string;
  }): ExecutionHistoryEntry {
    const entry: ExecutionHistoryEntry = {
      id:         `hist_${++_seq}`,
      errorClass: params.errorText ? _classifyError(params.errorText) : undefined,
      ts:         Date.now(),
      ...params,
    };
    _history.push(entry);
    if (_history.length > MAX_RUNS) _history.shift();

    // Write-through: persist to long-term memory platform (fire-and-forget)
    memoryEngine.store({
      category: 'execution',
      content:  JSON.stringify({
        runId:      params.runId,
        taskId:     params.taskId,
        toolName:   params.toolName,
        kind:       params.kind,
        outcome:    params.outcome,
        retries:    params.retries,
        durationMs: params.durationMs,
        errorClass: entry.errorClass,
        fixApplied: params.fixApplied,
      }),
      tags:  [params.toolName, params.outcome, params.kind, ...(entry.errorClass ? [entry.errorClass] : [])],
      score: params.outcome === 'success' ? 1.0 : params.outcome === 'partial' ? 0.5 : 0.2,
      meta:  { runId: params.runId, agentSource: 'executor-execution-history' },
    }).catch(console.error);

    return entry;
  },

  recordFailure(params: {
    runId:     string;
    taskId:    string;
    toolName:  string;
    kind:      TaskKind;
    errorText: string;
    retries:   number;
    durationMs: number;
  }): ExecutionHistoryEntry {
    return this.recordExecution({ ...params, outcome: 'failure' });
  },

  recordSuccess(params: {
    runId:       string;
    taskId:      string;
    toolName:    string;
    kind:        TaskKind;
    retries:     number;
    durationMs:  number;
    fixApplied?: string;
  }): ExecutionHistoryEntry {
    return this.recordExecution({ ...params, outcome: 'success' });
  },

  /** Find the most recent entry where the same tool failed with a similar error. */
  findSimilarFailure(toolName: string, errorText: string): ExecutionHistoryEntry | undefined {
    const cls = _classifyError(errorText);
    return [..._history].reverse().find(
      (e) => e.toolName === toolName && e.outcome === 'failure' && e.errorClass === cls,
    );
  },

  /** Return entries for a specific run, newest first. */
  getByRun(runId: string): ExecutionHistoryEntry[] {
    return _history.filter((e) => e.runId === runId).reverse();
  },

  getExecutionHistory(limit = 50): ExecutionHistoryEntry[] {
    return _history.slice(-limit).reverse();
  },

  /** Was a fix for this errorClass ever recorded as successful? */
  hasPriorFix(toolName: string, errorClass: string): string | undefined {
    return [..._history].reverse().find(
      (e) => e.toolName === toolName && e.outcome === 'success' && e.fixApplied,
    )?.fixApplied;
  },

  summary(): ExecutionHistorySummary {
    const total = _history.length;
    if (total === 0) {
      return { totalRecorded: 0, successRate: 0, avgRetries: 0, topFailures: [], topSuccessTools: [] };
    }
    const successes  = _history.filter((e) => e.outcome === 'success').length;
    const totalRetries = _history.reduce((s, e) => s + e.retries, 0);

    const failureCounts = new Map<string, number>();
    const successTools  = new Map<string, number>();
    for (const e of _history) {
      if (e.outcome === 'failure' && e.errorClass) {
        failureCounts.set(e.errorClass, (failureCounts.get(e.errorClass) ?? 0) + 1);
      }
      if (e.outcome === 'success') {
        successTools.set(e.toolName, (successTools.get(e.toolName) ?? 0) + 1);
      }
    }

    return {
      totalRecorded: total,
      successRate:   Math.round((successes / total) * 100) / 100,
      avgRetries:    Math.round((totalRetries / total) * 10) / 10,
      topFailures:   [...failureCounts.entries()]
        .sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([errorClass, count]) => ({ errorClass, count })),
      topSuccessTools: [...successTools.entries()]
        .sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([toolName, count]) => ({ toolName, count })),
    };
  },

  /**
   * Hydrate the in-process store from persisted entries loaded at startup.
   * Idempotent: skips if the store already has entries.
   * Returns the number of entries restored.
   */
  hydrate(entries: ExecutionHistoryEntry[]): number {
    if (_history.length > 0) return 0;       // already populated — skip
    if (entries.length === 0) return 0;

    for (const e of entries) {
      _history.push(e);
      // Advance sequence counter past any restored IDs
      const seq = parseInt(String(e.id).replace('hist_', ''), 10);
      if (!isNaN(seq) && seq > _seq) _seq = seq;
    }

    // Enforce ring-buffer limit (keep newest)
    while (_history.length > MAX_RUNS) _history.shift();

    return _history.length;
  },

  reset(): void { _history.length = 0; _seq = 0; },
  size():  number { return _history.length; },
};
