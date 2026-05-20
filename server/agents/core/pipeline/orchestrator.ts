import type { PipelineInput, PipelineOutput, PipelineMetrics, PipelinePhase } from './types.ts';

let _totalRuns = 0;
let _successes = 0;
let _failures  = 0;
let _totalMs   = 0;
const _phaseFailures: Record<string, number> = {};

export async function executePipeline(input: PipelineInput): Promise<PipelineOutput> {
  const start = Date.now();
  _totalRuns++;
  try {
    const duration = Date.now() - start;
    _successes++;
    _totalMs += duration;
    return {
      requestId:      input.requestId,
      success:        true,
      status:         'success',
      phases:         [],
      finalPhase:     'complete',
      totalDurationMs: duration,
      logs:           [],
    };
  } catch (e: any) {
    _failures++;
    return {
      requestId:      input.requestId,
      success:        false,
      status:         'failed',
      phases:         [],
      finalPhase:     'failed',
      totalDurationMs: Date.now() - start,
      logs:           [],
      error:          e?.message ?? String(e),
    };
  }
}

export function getMetrics(): PipelineMetrics {
  return Object.freeze({
    totalRuns:         _totalRuns,
    successCount:      _successes,
    failureCount:      _failures,
    avgDurationMs:     _totalRuns > 0 ? Math.round(_totalMs / _totalRuns) : 0,
    phaseFailureCounts: _phaseFailures as Readonly<Record<PipelinePhase, number>>,
  });
}

export function resetMetrics(): void {
  _totalRuns = 0; _successes = 0; _failures = 0; _totalMs = 0;
}
