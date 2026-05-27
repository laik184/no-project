import type { ServerHealth, ServerState } from '../types/runtime.types.ts';
import type { EndpointSpec } from '../types/verifier.types.ts';
import { checkServerHealth } from './server-healthcheck.ts';
import { checkAllEndpoints, summarizeEndpointResults } from './endpoint-checker.ts';
import { verifierLogger } from '../telemetry/verifier-logger.ts';

export interface RuntimeCheckOptions {
  port?:        number;
  endpoints?:   EndpointSpec[];
  timeoutMs?:   number;
  retries?:     number;
}

export interface RuntimeCheckSummary {
  healthy:        boolean;
  state:          ServerState;
  endpointsPassed: number;
  endpointsFailed: number;
  errors:         string[];
  health:         ServerHealth;
}

export async function checkRuntime(
  runId: string,
  opts:  RuntimeCheckOptions = {},
): Promise<RuntimeCheckSummary> {
  verifierLogger.phase(runId, 'runtime', 'start', { port: opts.port });

  const healthResult = await checkServerHealth({
    port:     opts.port ?? 3001,
    timeoutMs: opts.timeoutMs ?? 5000,
    retries:  opts.retries ?? 2,
    retryDelayMs: 1000,
  });

  const health: ServerHealth = {
    state:  healthResult.state,
    port:   opts.port,
    checks: [healthResult],
  };

  const errors: string[] = [];
  let endpointsPassed = 0;
  let endpointsFailed = 0;

  if (!healthResult.healthy) {
    errors.push(healthResult.error ?? 'Server is unreachable');
    verifierLogger.phase(runId, 'runtime', 'fail', { state: healthResult.state });
    return { healthy: false, state: healthResult.state, endpointsPassed, endpointsFailed, errors, health };
  }

  if (opts.endpoints?.length) {
    const results = await checkAllEndpoints(opts.endpoints, { port: opts.port });
    const summary  = summarizeEndpointResults(results);
    endpointsPassed = summary.passed;
    endpointsFailed = summary.failed;
    errors.push(...summary.errors);
  }

  const healthy = errors.length === 0;
  verifierLogger.phase(runId, 'runtime', healthy ? 'end' : 'fail', {
    endpointsPassed, endpointsFailed,
  });

  return { healthy, state: healthResult.state, endpointsPassed, endpointsFailed, errors, health };
}
