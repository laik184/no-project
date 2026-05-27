/**
 * performance-report.ts
 * Formats browser performance metrics into a structured report.
 */

import type { PerformanceSummary }    from '../types/reporting.types.ts';
import type { PerformanceValidation } from '../types/validation.types.ts';
import {
  PERF_THRESHOLDS,
  formatMs,
}                                     from '../utils/performance-utils.ts';

export interface PerformanceReport {
  ok:                     boolean;
  loadTimeMs?:            number;
  renderTimeMs?:          number;
  interactionLatencyMs?:  number;
  loadTimeLabel:          'fast' | 'acceptable' | 'slow' | 'unknown';
  thresholds:             typeof PERF_THRESHOLDS;
}

export function buildPerformanceReport(summary: PerformanceSummary): PerformanceReport {
  const loadTimeMs          = summary.loadTimeMs;
  const renderTimeMs        = summary.renderTimeMs;
  const interactionLatencyMs = summary.interactionLatencyMs;

  let loadTimeLabel: PerformanceReport['loadTimeLabel'] = 'unknown';
  let ok = true;

  if (loadTimeMs !== undefined) {
    if (loadTimeMs < 1_500)                                      loadTimeLabel = 'fast';
    else if (loadTimeMs < PERF_THRESHOLDS.LOAD_TIME_WARN_MS)     loadTimeLabel = 'acceptable';
    else if (loadTimeMs < PERF_THRESHOLDS.LOAD_TIME_FAIL_MS)     loadTimeLabel = 'slow';
    else {
      loadTimeLabel = 'slow';
      ok            = false;
    }
  }

  if (interactionLatencyMs !== undefined &&
      interactionLatencyMs > PERF_THRESHOLDS.INTERACTION_FAIL_MS) {
    ok = false;
  }

  return {
    ok,
    loadTimeMs,
    renderTimeMs,
    interactionLatencyMs,
    loadTimeLabel,
    thresholds: PERF_THRESHOLDS,
  };
}

export function formatPerformanceReport(summary: PerformanceSummary): string {
  const report = buildPerformanceReport(summary);
  const status = report.ok ? '✓ PASS' : '✗ FAIL';

  const lines = [`Performance — ${status}`];

  if (report.loadTimeMs !== undefined) {
    lines.push(`  Load time:   ${formatMs(report.loadTimeMs)} (${report.loadTimeLabel})`);
  }
  if (report.renderTimeMs !== undefined) {
    lines.push(`  Render time: ${formatMs(report.renderTimeMs)}`);
  }
  if (report.interactionLatencyMs !== undefined) {
    lines.push(`  Interaction: ${formatMs(report.interactionLatencyMs)}`);
  }

  lines.push(`  Thresholds: warn=${formatMs(PERF_THRESHOLDS.LOAD_TIME_WARN_MS)} fail=${formatMs(PERF_THRESHOLDS.LOAD_TIME_FAIL_MS)}`);
  return lines.join('\n');
}

export function validatePerformanceSummary(
  summary: PerformanceSummary,
  thresholdMs = PERF_THRESHOLDS.LOAD_TIME_FAIL_MS,
): PerformanceValidation {
  const loadTimeMs     = summary.loadTimeMs ?? 0;
  const withinThreshold = loadTimeMs < thresholdMs;

  return {
    ok:              withinThreshold,
    loadTimeMs,
    renderTimeMs:    summary.renderTimeMs,
    thresholdMs,
    withinThreshold,
  };
}
