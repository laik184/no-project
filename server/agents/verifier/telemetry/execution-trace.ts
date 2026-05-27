import type { VerificationPhase } from '../types/verifier.types.ts';

interface TraceEntry {
  phase:     VerificationPhase | 'overall';
  event:     string;
  timestamp: Date;
  meta?:     Record<string, unknown>;
}

const traces = new Map<string, TraceEntry[]>();

function getOrCreate(runId: string): TraceEntry[] {
  if (!traces.has(runId)) traces.set(runId, []);
  return traces.get(runId)!;
}

export const executionTrace = {
  record(
    runId:  string,
    phase:  VerificationPhase | 'overall',
    event:  string,
    meta?:  Record<string, unknown>,
  ): void {
    getOrCreate(runId).push({ phase, event, timestamp: new Date(), meta });
  },

  getAll(runId: string): TraceEntry[] {
    return traces.get(runId) ?? [];
  },

  getForPhase(runId: string, phase: VerificationPhase): TraceEntry[] {
    return (traces.get(runId) ?? []).filter((e) => e.phase === phase);
  },

  clear(runId: string): void {
    traces.delete(runId);
  },

  export(runId: string): string {
    return (traces.get(runId) ?? [])
      .map((e) => {
        const meta = e.meta ? ` ${JSON.stringify(e.meta)}` : '';
        return `[${e.timestamp.toISOString()}][${e.phase}] ${e.event}${meta}`;
      })
      .join('\n');
  },
};
