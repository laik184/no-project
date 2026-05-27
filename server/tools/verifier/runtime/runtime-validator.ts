import { checkRuntime }         from '../../../agents/verifier/runtime/runtime-checker.ts';
import type { RuntimeCheckOptions, RuntimeCheckSummary } from '../../../agents/verifier/runtime/runtime-checker.ts';
import type { ToolDefinition, ToolExecutionContext }     from '../../registry/tool-types.ts';
import type { EndpointSpec }                             from '../shared/verifier-types.ts';
import { toToolOk, toToolFail }                          from '../shared/verifier-result.ts';

export { type RuntimeCheckOptions, type RuntimeCheckSummary };

export const runtimeValidatorTool: ToolDefinition = {
  name:        'validate_runtime',
  category:    'verifier',
  description: 'Full runtime validation: server health + optional endpoint checks',
  inputSchema: {
    runId:     { type: 'string', description: 'Run ID',     required: true },
    port:      { type: 'number', description: 'Server port' },
    endpoints: { type: 'array',  description: 'Endpoint specs to validate' },
    timeoutMs: { type: 'number', description: 'Per-check timeout (ms)' },
    retries:   { type: 'number', description: 'Health check retries' },
  },
  permissions: ['network'],
  timeoutMs:   60_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler:     async (input: Record<string, unknown>, _ctx: ToolExecutionContext) => {
    const start = Date.now();
    try {
      const result = await checkRuntime(input.runId as string, {
        port:      input.port      ? Number(input.port)      : undefined,
        endpoints: input.endpoints as EndpointSpec[] | undefined,
        timeoutMs: input.timeoutMs ? Number(input.timeoutMs) : undefined,
        retries:   input.retries   ? Number(input.retries)   : undefined,
      });
      const ms = Date.now() - start;
      return result.healthy
        ? toToolOk(result, ms)
        : toToolFail(result.errors[0] ?? 'Runtime unhealthy', ms);
    } catch (err) {
      return toToolFail(String(err), Date.now() - start);
    }
  },
};
