/**
 * server/tools/verifier/validate-runtime-tool.ts
 * Tool: validate_runtime
 *
 * Full runtime validation: checks port binding AND makes a health probe.
 * Returns: { valid, port, portBound, httpOk, latencyMs, error? }
 */

import type { ToolDefinition, ToolExecutionContext } from '../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../registry/tool-metadata.ts';
import { commandService }                            from '../../services/terminal/index.ts';

const DEFAULT_PORT = 3001;

export interface RuntimeValidationResult {
  valid:     boolean;
  port:      number;
  portBound: boolean;
  httpOk:    boolean;
  latencyMs: number;
  error?:    string;
}

export const validateRuntimeTool: ToolDefinition = {
  name:        'validate_runtime',
  category:    'verifier',
  description: 'Validate the sandbox runtime by checking port binding and HTTP health.',
  inputSchema: {
    runId: { type: 'string', description: 'Execution run ID',             required: false },
    port:  { type: 'number', description: 'Port to validate (default 3001)', required: false },
  },
  permissions: ['execute'],
  timeoutMs:   TIMEOUT.SHELL,
  retry:       RETRY_ONCE,

  handler: async (input, _ctx: ToolExecutionContext): Promise<RuntimeValidationResult> => {
    const port  = (input.port as number | undefined) ?? DEFAULT_PORT;
    const start = Date.now();

    // 1. Check port binding via ss/netstat
    let portBound = false;
    try {
      const r = await commandService.execute(
        `ss -tlnp 2>/dev/null | grep :${port} || netstat -tlnp 2>/dev/null | grep :${port} || true`,
        { timeoutMs: 5_000 },
      );
      portBound = (r.stdout ?? '').includes(String(port));
    } catch {
      // ignore
    }

    // 2. HTTP probe
    let httpOk = false;
    try {
      const resp = await fetch(`http://localhost:${port}/`, {
        signal: AbortSignal.timeout(8_000),
      });
      httpOk = resp.status < 500;
    } catch {
      // ignore
    }

    const valid = portBound || httpOk;
    return {
      valid,
      port,
      portBound,
      httpOk,
      latencyMs: Date.now() - start,
      error:     valid ? undefined : `Port ${port} not bound and HTTP probe failed`,
    };
  },
};
