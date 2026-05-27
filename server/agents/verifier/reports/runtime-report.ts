import type { PhaseResult } from '../types/verifier.types.ts';
import type { RuntimeCheckSummary } from '../runtime/runtime-checker.ts';

export interface RuntimeReport {
  healthy:         boolean;
  serverState:     string;
  endpointsPassed: number;
  endpointsFailed: number;
  errors:          string[];
  summary:         string;
  generatedAt:     Date;
}

export function buildRuntimeReport(result: RuntimeCheckSummary): RuntimeReport {
  const summary = result.healthy
    ? `Server healthy — ${result.endpointsPassed} endpoint(s) verified`
    : `Runtime unhealthy — ${result.errors.slice(0, 2).join('; ')}`;

  return {
    healthy:         result.healthy,
    serverState:     result.state,
    endpointsPassed: result.endpointsPassed,
    endpointsFailed: result.endpointsFailed,
    errors:          result.errors,
    summary,
    generatedAt: new Date(),
  };
}

export function toPhaseResult(result: RuntimeCheckSummary, durationMs: number): PhaseResult {
  return {
    phase:      'runtime',
    status:     result.healthy ? 'passed' : 'failed',
    durationMs,
    errors:     result.errors,
    warnings:   [],
  };
}

export function formatRuntimeReport(report: RuntimeReport): string {
  return [
    `Runtime: ${report.healthy ? 'HEALTHY' : 'UNHEALTHY'}`,
    `State:   ${report.serverState}`,
    `Endpoints: ${report.endpointsPassed} passed, ${report.endpointsFailed} failed`,
    report.errors.length ? `Errors: ${report.errors.join('; ')}` : '',
  ].filter(Boolean).join('\n');
}
