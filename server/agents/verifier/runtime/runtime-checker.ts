/**
 * runtime/runtime-checker.ts
 * Full runtime validation: server health + optional endpoint checks.
 * Called by server/tools/verifier/runtime/runtime-validator.ts.
 */

import type { RuntimeCheckResult } from '../types/runtime.types.ts';
import type { EndpointSpec } from '../types/verifier.types.ts';
import { checkServerHealth } from './server-healthcheck.ts';
import { checkAllEndpoints } from './endpoint-checker.ts';

export interface RuntimeCheckOptions {
  port?:      number;
  host?:      string;
  timeoutMs?: number;
  retries?:   number;
  endpoints?: EndpointSpec[];
}

export interface RuntimeCheckSummary extends RuntimeCheckResult {
  endpointsPassed: number;
  endpointsFailed: number;
}

export async function checkRuntime(
  runId: string,
  opts:  RuntimeCheckOptions = {},
): Promise<RuntimeCheckSummary> {
  const healthResult = await checkServerHealth({
    port:      opts.port,
    host:      opts.host,
    timeoutMs: opts.timeoutMs,
    retries:   opts.retries,
  });

  if (!healthResult.healthy) {
    return { ...healthResult, endpointsPassed: 0, endpointsFailed: 0 };
  }

  let endpointsPassed = 0;
  let endpointsFailed = 0;
  const extraErrors: string[] = [];

  if (opts.endpoints?.length) {
    const epResults = await checkAllEndpoints(opts.endpoints, {
      port:      opts.port,
      timeoutMs: opts.timeoutMs,
    });
    endpointsPassed = epResults.filter((r) => r.passed).length;
    endpointsFailed = epResults.filter((r) => !r.passed).length;
    for (const r of epResults) {
      if (!r.passed) extraErrors.push(r.error ?? `Endpoint failed: ${r.path}`);
    }
  }

  return {
    ...healthResult,
    healthy:   endpointsFailed === 0,
    errors:    [...healthResult.errors, ...extraErrors],
    endpointsPassed,
    endpointsFailed,
  };
}

export async function validateRuntime(
  runId: string,
  opts:  RuntimeCheckOptions = {},
): Promise<{ valid: boolean; errors: string[] }> {
  const result = await checkRuntime(runId, opts);
  return { valid: result.healthy, errors: result.errors };
}
