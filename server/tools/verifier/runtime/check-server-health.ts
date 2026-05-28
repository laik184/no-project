import {
  checkServerHealth as _checkServerHealth,
  waitForServer     as _waitForServer,
  type HealthCheckOptions,
} from '../lib/server-healthcheck.ts';
import type { RuntimeCheckResult }                   from '../shared/verifier-types.ts';
import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { toToolOk, toToolFail }                      from '../shared/verifier-result.ts';
import { verifierMetrics }                           from '../monitoring/verification-metrics.ts';

export type { HealthCheckOptions };

export async function checkServerHealth(opts: HealthCheckOptions = {}): Promise<RuntimeCheckResult> {
  return _checkServerHealth(opts);
}

export async function waitForServer(opts: HealthCheckOptions, maxWaitMs: number): Promise<boolean> {
  return _waitForServer(opts, maxWaitMs);
}

export const checkServerHealthTool: ToolDefinition = {
  name:        'check_server_health',
  category:    'verifier',
  description: 'Check if the project server is up and responding',
  inputSchema: {
    runId:     { type: 'string', description: 'Run ID',              required: true },
    port:      { type: 'number', description: 'Server port' },
    host:      { type: 'string', description: 'Server host' },
    path:      { type: 'string', description: 'Health check path' },
    timeoutMs: { type: 'number', description: 'Request timeout (ms)' },
    retries:   { type: 'number', description: 'Retry attempts' },
  },
  permissions: ['network'],
  timeoutMs:   15_000,
  retry:       { maxAttempts: 2, delayMs: 1_000, backoff: 'linear' },
  handler:     async (input: Record<string, unknown>, ctx: ToolExecutionContext) => {
    const start = Date.now();
    try {
      const result = await checkServerHealth({
        port:      input.port      ? Number(input.port)      : undefined,
        host:      input.host      as string | undefined,
        path:      input.path      as string | undefined,
        timeoutMs: input.timeoutMs ? Number(input.timeoutMs) : undefined,
        retries:   input.retries   ? Number(input.retries)   : undefined,
      });
      const ms = Date.now() - start;
      if (!result.healthy) verifierMetrics.recordCrash(ctx.runId);
      return result.healthy
        ? toToolOk(result, ms)
        : toToolFail(result.error ?? 'Server unhealthy', ms);
    } catch (err) {
      return toToolFail(String(err), Date.now() - start);
    }
  },
};
