/**
 * server/tools/coding/shared/coding-context.ts
 *
 * Per-run telemetry for the coding tool layer.
 * Tracks generation counts, durations, validation failures, and retries.
 */

export interface CodingRunMetrics {
  generationsTotal:      number;
  generationsTemplate:   number;
  generationsLlm:        number;
  validationFailures:    number;
  syntaxFailures:        number;
  llmCallCount:          number;
  totalDurationMs:       number;
  startedAt:             number;
}

const store = new Map<string, CodingRunMetrics>();

function getOrCreate(runId: string): CodingRunMetrics {
  if (!store.has(runId)) {
    store.set(runId, {
      generationsTotal:    0,
      generationsTemplate: 0,
      generationsLlm:      0,
      validationFailures:  0,
      syntaxFailures:      0,
      llmCallCount:        0,
      totalDurationMs:     0,
      startedAt:           Date.now(),
    });
  }
  return store.get(runId)!;
}

export const codingContext = {
  recordGeneration(runId: string, strategy: 'template' | 'llm', durationMs: number): void {
    const m = getOrCreate(runId);
    m.generationsTotal++;
    m.totalDurationMs += durationMs;
    if (strategy === 'template') m.generationsTemplate++;
    else                          m.generationsLlm++;
  },

  recordValidationFailure(runId: string): void {
    getOrCreate(runId).validationFailures++;
  },

  recordSyntaxFailure(runId: string): void {
    getOrCreate(runId).syntaxFailures++;
  },

  recordLlmCall(runId: string): void {
    getOrCreate(runId).llmCallCount++;
  },

  get(runId: string): CodingRunMetrics | undefined {
    return store.get(runId);
  },

  summary(runId: string): CodingRunMetrics & { uptimeMs: number } {
    const m = getOrCreate(runId);
    return { ...m, uptimeMs: Date.now() - m.startedAt };
  },

  evict(runId: string): void {
    store.delete(runId);
  },
};
