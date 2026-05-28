/**
 * runtime/server-healthcheck.ts
 * HTTP health-check implementation for the running dev server.
 * Called by server/tools/verifier/runtime/check-server-health.ts.
 */

import type { RuntimeCheckResult } from '../types/runtime.types.ts';

export interface HealthCheckOptions {
  port?:      number;
  host?:      string;
  path?:      string;
  timeoutMs?: number;
  retries?:   number;
}

const DEFAULT_PORT    = 3001;
const DEFAULT_TIMEOUT = 10_000;
const HEALTH_PATHS    = ['/', '/health', '/api/health'];

async function tryFetch(url: string, timeoutMs: number): Promise<{ ok: boolean; status: number }> {
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const resp  = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    return { ok: resp.status < 500, status: resp.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

export async function checkServerHealth(opts: HealthCheckOptions = {}): Promise<RuntimeCheckResult> {
  const port      = opts.port      ?? DEFAULT_PORT;
  const host      = opts.host      ?? 'localhost';
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT;
  const retries   = opts.retries   ?? 0;
  const paths     = opts.path ? [opts.path] : HEALTH_PATHS;

  for (const path of paths) {
    const url = `http://${host}:${port}${path}`;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const result = await tryFetch(url, timeoutMs);
      if (result.ok) {
        return {
          healthy:   true,
          state:     'running',
          details:   `Healthy on ${url} (${result.status})`,
          checkedAt: new Date(),
          errors:    [],
        };
      }
      if (attempt < retries) await new Promise((r) => setTimeout(r, 1_000));
    }
  }

  return {
    healthy:   false,
    state:     'unhealthy',
    details:   `No healthy endpoint on port ${port}`,
    checkedAt: new Date(),
    errors:    [`No healthy endpoint found on port ${port}`],
  };
}

export async function waitForServer(opts: HealthCheckOptions, maxWaitMs: number): Promise<boolean> {
  const start    = Date.now();
  const interval = 1_000;

  while (Date.now() - start < maxWaitMs) {
    const result = await checkServerHealth(opts);
    if (result.healthy) return true;
    await new Promise((r) => setTimeout(r, interval));
  }
  return false;
}
