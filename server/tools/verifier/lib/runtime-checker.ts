import { checkServerHealth }  from './server-healthcheck.ts';
import { checkAllEndpoints }  from './endpoint-checker.ts';
import type { EndpointSpec }  from './verifier-types.ts';

export interface RuntimeCheckOptions {
  port?:      number;
  host?:      string;
  endpoints?: EndpointSpec[];
  timeoutMs?: number;
  retries?:   number;
}

export interface RuntimeCheckSummary {
  healthy:       boolean;
  serverHealthy: boolean;
  errors:        string[];
  warnings:      string[];
  checkedAt:     number;
}

export async function checkRuntime(
  runId:   string,
  opts:    RuntimeCheckOptions = {},
): Promise<RuntimeCheckSummary> {
  const errors:   string[] = [];
  const warnings: string[] = [];

  const health = await checkServerHealth({
    port:      opts.port,
    host:      opts.host,
    timeoutMs: opts.timeoutMs,
    retries:   opts.retries,
  });

  if (!health.healthy) {
    errors.push(health.error ?? 'Server is not healthy');
  }

  if (opts.endpoints && opts.endpoints.length > 0 && health.healthy) {
    const results = await checkAllEndpoints(opts.endpoints, { port: opts.port, host: opts.host, timeoutMs: opts.timeoutMs });
    const failed  = results.filter((r) => !r.success);
    for (const f of failed) {
      errors.push(`${f.method} ${f.path}: expected ${f.expectedStatus}, got ${f.actualStatus ?? 'no response'}`);
    }
  }

  return {
    healthy:       errors.length === 0,
    serverHealthy: health.healthy,
    errors,
    warnings,
    checkedAt:     Date.now(),
  };
}
