import type { EndpointCheckResult } from '../types/runtime.types.ts';
import type { EndpointSpec } from '../types/verifier.types.ts';
import { validateHttpResponse } from '../validation/response-validator.ts';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_PORT       = 3001;

export interface EndpointCheckOptions {
  host?:      string;
  port?:      number;
  timeoutMs?: number;
}

export async function checkEndpoint(
  spec: EndpointSpec,
  opts: EndpointCheckOptions = {},
): Promise<EndpointCheckResult> {
  const host    = opts.host ?? '127.0.0.1';
  const port    = opts.port ?? DEFAULT_PORT;
  const timeout = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const url     = `http://${host}:${port}${spec.path}`;

  const start      = Date.now();
  let   status     = 0;
  let   body: unknown;
  let   error: string | undefined;

  try {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), timeout);

    const res = await fetch(url, {
      method:  spec.method,
      headers: { 'Content-Type': 'application/json' },
      body:    spec.body ? JSON.stringify(spec.body) : undefined,
      signal:  controller.signal,
    });
    clearTimeout(timer);

    status = res.status;
    try { body = await res.json(); } catch { body = await res.text(); }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const responseTimeMs = Date.now() - start;
  const validation     = validateHttpResponse({ status, expectedStatus: spec.expectedStatus });

  return {
    path:           spec.path,
    method:         spec.method,
    status,
    expectedStatus: spec.expectedStatus,
    passed:         validation.valid && !error,
    responseTimeMs,
    error:          error ?? (validation.valid ? undefined : validation.errors[0]),
    body,
  };
}

export async function checkAllEndpoints(
  specs: EndpointSpec[],
  opts:  EndpointCheckOptions = {},
): Promise<EndpointCheckResult[]> {
  return Promise.all(specs.map((s) => checkEndpoint(s, opts)));
}

export function summarizeEndpointResults(results: EndpointCheckResult[]): {
  passed: number;
  failed: number;
  errors: string[];
} {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const errors = results
    .filter((r) => !r.passed)
    .map((r) => `${r.method} ${r.path}: ${r.error ?? `status ${r.status}`}`);
  return { passed, failed, errors };
}
