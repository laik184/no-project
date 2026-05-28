import type { RuntimeCheckResult, ServerHealth, ServerState } from './verifier-types.ts';

export interface HealthCheckOptions {
  port?:     number;
  host?:     string;
  path?:     string;
  timeoutMs?: number;
  retries?:  number;
}

async function attempt(url: string, timeoutMs: number): Promise<{ ok: boolean; status: number; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), timeoutMs);
    const resp       = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
    return { ok: resp.status < 500, status: resp.status, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, status: 0, latencyMs: Date.now() - start, error: String(err) };
  }
}

export async function checkServerHealth(opts: HealthCheckOptions = {}): Promise<RuntimeCheckResult> {
  const port     = opts.port     ?? 3000;
  const host     = opts.host     ?? '127.0.0.1';
  const path     = opts.path     ?? '/';
  const timeout  = opts.timeoutMs ?? 5_000;
  const retries  = opts.retries  ?? 2;
  const url      = `http://${host}:${port}${path}`;

  let last: { ok: boolean; status: number; latencyMs: number; error?: string } = { ok: false, status: 0, latencyMs: 0 };
  for (let i = 0; i <= retries; i++) {
    last = await attempt(url, timeout);
    if (last.ok) break;
    if (i < retries) await new Promise((r) => setTimeout(r, 500));
  }

  const state: ServerState = last.ok ? 'ready' : (last.status === 0 ? 'crashed' : 'unhealthy');
  const health: ServerHealth = { state, port, latencyMs: last.latencyMs, checkedAt: Date.now() };

  return {
    healthy:    last.ok,
    error:      last.ok ? undefined : (last.error ?? `HTTP ${last.status}`),
    health,
    statusCode: last.status,
  };
}

export async function waitForServer(opts: HealthCheckOptions, maxWaitMs: number): Promise<boolean> {
  const interval = 500;
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const result = await checkServerHealth({ ...opts, retries: 0 });
    if (result.healthy) return true;
    await new Promise((r) => setTimeout(r, interval));
  }
  return false;
}
