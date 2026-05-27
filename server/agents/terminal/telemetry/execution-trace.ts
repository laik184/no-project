import { generateTraceId, now } from '../utils/runtime-utils.ts';

export interface TraceSpan {
  traceId:    string;
  runId:      string;
  command:    string;
  startedAt:  Date;
  endedAt?:   Date;
  durationMs?: number;
  exitCode?:  number;
  success?:   boolean;
}

const spans = new Map<string, TraceSpan>();

export const executionTrace = {
  start(runId: string, command: string): string {
    const traceId = generateTraceId();
    spans.set(traceId, { traceId, runId, command, startedAt: now() });
    return traceId;
  },

  end(traceId: string, exitCode: number): void {
    const span = spans.get(traceId);
    if (!span) return;
    const endedAt   = now();
    span.endedAt    = endedAt;
    span.durationMs = endedAt.getTime() - span.startedAt.getTime();
    span.exitCode   = exitCode;
    span.success    = exitCode === 0;
  },

  get(traceId: string): TraceSpan | undefined {
    return spans.get(traceId);
  },

  listByRun(runId: string): TraceSpan[] {
    return Array.from(spans.values()).filter((s) => s.runId === runId);
  },

  clear(runId: string): void {
    for (const [id, span] of spans.entries()) {
      if (span.runId === runId) spans.delete(id);
    }
  },
};
