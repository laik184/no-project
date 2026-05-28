import type { EndpointSpec, EndpointCheckResult } from './verifier-types.ts';

export interface EndpointCheckOptions {
  port?:     number;
  host?:     string;
  timeoutMs?: number;
}

export interface EndpointSummary {
  passed: number;
  failed: number;
  total:  number;
}

export async function checkEndpoint(
  spec: EndpointSpec,
  opts: EndpointCheckOptions = {},
): Promise<EndpointCheckResult> {
  const port    = opts.port     ?? 3000;
  const host    = opts.host     ?? '127.0.0.1';
  const timeout = opts.timeoutMs ?? 5_000;
  const url     = `http://${host}:${port}${spec.path}`;
  const start   = Date.now();
  try {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), timeout);
    const resp       = await fetch(url, {
      method:  spec.method,
      headers: spec.headers ?? {},
      body:    spec.body && spec.method !== 'GET' ? JSON.stringify(spec.body) : undefined,
      signal:  controller.signal,
    }).finally(() => clearTimeout(timer));
    const latencyMs    = Date.now() - start;
    const actualStatus = resp.status;
    const success      = actualStatus === spec.expectedStatus;
    return { path: spec.path, method: spec.method, expectedStatus: spec.expectedStatus, actualStatus, success, latencyMs };
  } catch (err) {
    return { path: spec.path, method: spec.method, expectedStatus: spec.expectedStatus, success: false, latencyMs: Date.now() - start, error: String(err) };
  }
}

export async function checkAllEndpoints(
  specs: EndpointSpec[],
  opts:  EndpointCheckOptions = {},
): Promise<EndpointCheckResult[]> {
  return Promise.all(specs.map((s) => checkEndpoint(s, opts)));
}

export function summarizeEndpointResults(results: EndpointCheckResult[]): EndpointSummary {
  const passed = results.filter((r) => r.success).length;
  return { passed, failed: results.length - passed, total: results.length };
}
