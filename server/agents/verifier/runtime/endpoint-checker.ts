/**
 * runtime/endpoint-checker.ts
 * Validates individual HTTP endpoints against expected status codes.
 * Called by server/tools/verifier/runtime/endpoint-validator.ts.
 */

import type { EndpointCheckResult } from '../types/runtime.types.ts';
import type { EndpointSpec } from '../types/verifier.types.ts';

const DEFAULT_PORT    = 3001;
const DEFAULT_TIMEOUT = 15_000;

export async function checkEndpoint(
  endpoint: EndpointSpec,
  opts: { port?: number; timeoutMs?: number } = {},
): Promise<EndpointCheckResult> {
  const port      = opts.port      ?? DEFAULT_PORT;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT;
  const { path, method, expectedStatus, body, headers = {} } = endpoint;
  const url   = `http://localhost:${port}${path}`;
  const start = Date.now();

  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const resp  = await fetch(url, {
      method,
      headers:  { 'Content-Type': 'application/json', ...headers },
      body:     body ? JSON.stringify(body) : undefined,
      signal:   ctrl.signal,
    });
    clearTimeout(timer);
    const durationMs   = Date.now() - start;
    const actualStatus = resp.status;
    const passed       = actualStatus === expectedStatus;
    return { path, method, expectedStatus, actualStatus, passed, durationMs, error: passed ? undefined : `Expected ${expectedStatus}, got ${actualStatus}` };
  } catch (err) {
    return { path, method, expectedStatus, actualStatus: 0, passed: false, durationMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function checkAllEndpoints(
  endpoints: EndpointSpec[],
  opts: { port?: number; timeoutMs?: number } = {},
): Promise<EndpointCheckResult[]> {
  return Promise.all(endpoints.map((ep) => checkEndpoint(ep, opts)));
}

export function summarizeEndpointResults(results: EndpointCheckResult[]): { passed: number; failed: number; total: number } {
  const passed = results.filter((r) => r.passed).length;
  return { passed, failed: results.length - passed, total: results.length };
}
