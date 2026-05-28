import {
  checkAllEndpoints,
  checkEndpoint,
  summarizeEndpointResults,
} from '../lib/endpoint-checker.ts';
import type { EndpointSpec, EndpointCheckResult } from '../shared/verifier-types.ts';
import type { ToolDefinition }                    from '../../registry/tool-types.ts';
import { toToolOk, toToolFail }                   from '../shared/verifier-result.ts';

export { checkEndpoint, checkAllEndpoints, summarizeEndpointResults };

export async function validateEndpoints(
  endpoints: EndpointSpec[],
  port?:     number,
): Promise<{ results: EndpointCheckResult[]; allPassed: boolean; failedCount: number }> {
  const results = await checkAllEndpoints(endpoints, { port });
  const summary = summarizeEndpointResults(results);
  return { results, allPassed: summary.failed === 0, failedCount: summary.failed };
}

export const endpointValidatorTool: ToolDefinition = {
  name:        'validate_endpoints',
  category:    'verifier',
  description: 'Validate HTTP endpoints return expected status codes',
  inputSchema: {
    runId:     { type: 'string', description: 'Run ID',         required: true },
    endpoints: { type: 'array',  description: 'Endpoint specs', required: true },
    port:      { type: 'number', description: 'Override port' },
  },
  permissions: ['network'],
  timeoutMs:   30_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler:     async (input: Record<string, unknown>) => {
    const start  = Date.now();
    const result = await validateEndpoints(
      input.endpoints as EndpointSpec[],
      input.port ? Number(input.port) : undefined,
    );
    const ms = Date.now() - start;
    return result.allPassed
      ? toToolOk(result, ms)
      : toToolFail(`${result.failedCount} endpoint(s) failed`, ms);
  },
};
