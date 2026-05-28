/**
 * telemetry/execution-trace.ts
 * Execution trace log for verifier agent runs.
 */

import type { VerificationPhase } from '../types/verifier.types.ts';

export interface TraceEntry {
  runId:     string;
  phase:     VerificationPhase | 'orchestration' | 'planning' | 'recovery';
  toolName?: string;
  event:     string;
  timestamp: Date;
  durationMs?: number;
  meta?:     Record<string, unknown>;
}

const traceStore = new Map<string, TraceEntry[]>();

function getTrace(runId: string): TraceEntry[] {
  if (!traceStore.has(runId)) traceStore.set(runId, []);
  return traceStore.get(runId)!;
}

export const executionTrace = {
  record(
    runId:     string,
    phase:     TraceEntry['phase'],
    event:     string,
    opts:      { toolName?: string; durationMs?: number; meta?: Record<string, unknown> } = {},
  ): void {
    getTrace(runId).push({
      runId,
      phase,
      toolName:   opts.toolName,
      event,
      timestamp:  new Date(),
      durationMs: opts.durationMs,
      meta:       opts.meta,
    });
  },

  getAll(runId: string): TraceEntry[] {
    return [...(traceStore.get(runId) ?? [])];
  },

  getForPhase(runId: string, phase: TraceEntry['phase']): TraceEntry[] {
    return (traceStore.get(runId) ?? []).filter((e) => e.phase === phase);
  },

  getDispatches(runId: string): TraceEntry[] {
    return (traceStore.get(runId) ?? []).filter((e) => e.event === 'dispatch');
  },

  clear(runId: string): void {
    traceStore.delete(runId);
  },

  export(runId: string): string {
    return (traceStore.get(runId) ?? [])
      .map((e) => {
        const tool = e.toolName ? ` tool=${e.toolName}` : '';
        const dur  = e.durationMs !== undefined ? ` (${e.durationMs}ms)` : '';
        const meta = e.meta ? ` ${JSON.stringify(e.meta)}` : '';
        return `[${e.timestamp.toISOString()}][${e.phase}] ${e.event}${tool}${dur}${meta}`;
      })
      .join('\n');
  },
};
