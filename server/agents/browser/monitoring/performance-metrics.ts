/**
 * performance-metrics.ts
 * ONLY responsible for collecting and storing browser performance metrics per run.
 */

import type { Page }            from 'playwright';
import type { PerformanceSummary } from '../types/reporting.types.ts';
import { collectPerformanceTiming } from '../validation/performance-tracker.ts';
import { browserLogger }        from '../telemetry/browser-logger.ts';
import { elapsed }              from '../utils/performance-utils.ts';

interface InteractionSample {
  action:     string;
  durationMs: number;
}

interface RunPerformanceData {
  loadTimeMs?:   number;
  renderTimeMs?: number;
  interactions:  InteractionSample[];
  startedAt:     number;
}

const store = new Map<string, RunPerformanceData>();

function getOrCreate(runId: string): RunPerformanceData {
  if (!store.has(runId)) {
    store.set(runId, { interactions: [], startedAt: Date.now() });
  }
  return store.get(runId)!;
}

export async function capturePageMetrics(page: Page, runId: string): Promise<PerformanceSummary> {
  const perf = await collectPerformanceTiming(page, runId);
  const data = getOrCreate(runId);

  if (perf.loadTimeMs !== undefined)  data.loadTimeMs  = perf.loadTimeMs;
  if (perf.renderTimeMs !== undefined) data.renderTimeMs = perf.renderTimeMs;

  return perf;
}

export function recordInteractionLatency(
  runId:      string,
  action:     string,
  durationMs: number,
): void {
  getOrCreate(runId).interactions.push({ action, durationMs });
}

export function getAverageInteractionLatency(runId: string): number | undefined {
  const data = store.get(runId);
  if (!data || data.interactions.length === 0) return undefined;
  const total = data.interactions.reduce((sum, s) => sum + s.durationMs, 0);
  return Math.round(total / data.interactions.length);
}

export function getPerformanceSummary(runId: string): PerformanceSummary {
  const data = store.get(runId);
  if (!data) return {};
  return {
    loadTimeMs:            data.loadTimeMs,
    renderTimeMs:          data.renderTimeMs,
    interactionLatencyMs:  getAverageInteractionLatency(runId),
  };
}

export function evictPerformanceData(runId: string): void {
  store.delete(runId);
}
