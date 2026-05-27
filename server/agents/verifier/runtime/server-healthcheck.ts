import type { RuntimeCheckResult, ServerState } from '../types/runtime.types.ts';
import { sleep } from '../../../orchestration/utils/execution-utils.ts';

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_PORT       = 3001;

export interface HealthCheckOptions {
  host?:      string;
  port?:      number;
  path?:      string;
  timeoutMs?: number;
  retries?:   number;
  retryDelayMs?: number;
}

export async function checkServerHealth(
  opts: HealthCheckOptions = {},
): Promise<RuntimeCheckResult> {
  const host     = opts.host    ?? '127.0.0.1';
  const port     = opts.port    ?? DEFAULT_PORT;
  const path     = opts.path    ?? '/';
  const timeout  = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries  = opts.retries ?? 1;
  const delay    = opts.retryDelayMs ?? 1000;

  const url = `http://${host}:${port}${path}`;

  for (let attempt = 0; attempt < retries; attempt++) {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timer      = setTimeout(() => controller.abort(), timeout);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      const responseTimeMs = Date.now() - start;
      const state: ServerState = res.status < 500 ? 'up' : 'down';

      return { healthy: state === 'up', state, responseTimeMs, checkedAt: new Date() };
    } catch (err) {
      if (attempt < retries - 1) await sleep(delay);
    }
  }

  return { healthy: false, state: 'down', error: `Server unreachable at ${url}`, checkedAt: new Date() };
}

export async function waitForServer(
  opts:       HealthCheckOptions,
  maxWaitMs:  number,
): Promise<boolean> {
  const start    = Date.now();
  const interval = opts.retryDelayMs ?? 1000;

  while (Date.now() - start < maxWaitMs) {
    const result = await checkServerHealth({ ...opts, retries: 1 });
    if (result.healthy) return true;
    await sleep(interval);
  }
  return false;
}
