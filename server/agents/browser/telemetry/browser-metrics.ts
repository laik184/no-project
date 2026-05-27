/**
 * browser-metrics.ts
 * In-memory per-run browser operation counters.
 */

interface RunMetrics {
  pageLoads:          number;
  pageLoadFailures:   number;
  screenshots:        number;
  crashes:            number;
  consoleErrors:      number;
  interactionFailures: number;
  validationFailures: number;
  flowsRun:           number;
  startedAt:          number;
}

const store = new Map<string, RunMetrics>();

function getOrCreate(runId: string): RunMetrics {
  if (!store.has(runId)) {
    store.set(runId, {
      pageLoads:           0,
      pageLoadFailures:    0,
      screenshots:         0,
      crashes:             0,
      consoleErrors:       0,
      interactionFailures: 0,
      validationFailures:  0,
      flowsRun:            0,
      startedAt:           Date.now(),
    });
  }
  return store.get(runId)!;
}

export const browserMetrics = {
  recordPageLoad(runId: string, success: boolean): void {
    const m = getOrCreate(runId);
    m.pageLoads++;
    if (!success) m.pageLoadFailures++;
  },

  recordScreenshot(runId: string): void {
    getOrCreate(runId).screenshots++;
  },

  recordCrash(runId: string): void {
    const m = getOrCreate(runId);
    m.crashes++;
  },

  recordConsoleError(runId: string): void {
    getOrCreate(runId).consoleErrors++;
  },

  recordInteractionFailure(runId: string): void {
    getOrCreate(runId).interactionFailures++;
  },

  recordValidationFailure(runId: string): void {
    getOrCreate(runId).validationFailures++;
  },

  recordFlow(runId: string): void {
    getOrCreate(runId).flowsRun++;
  },

  get(runId: string): RunMetrics | undefined {
    return store.get(runId);
  },

  evict(runId: string): void {
    store.delete(runId);
  },

  summary(runId: string): Record<string, number> {
    const m = getOrCreate(runId);
    return {
      pageLoads:           m.pageLoads,
      pageLoadFailures:    m.pageLoadFailures,
      screenshots:         m.screenshots,
      crashes:             m.crashes,
      consoleErrors:       m.consoleErrors,
      interactionFailures: m.interactionFailures,
      validationFailures:  m.validationFailures,
      flowsRun:            m.flowsRun,
      uptimeMs:            Date.now() - m.startedAt,
    };
  },
};
