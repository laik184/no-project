/**
 * server/tools/verifier/check-server-health-tool.ts
 * Tool: check_server_health
 *
 * Sends an HTTP GET to localhost:PORT to verify the dev server is alive.
 * Returns: { healthy, port, status, latencyMs, error? }
 */

import type { ToolDefinition, ToolExecutionContext } from '../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../registry/tool-metadata.ts';

const DEFAULT_PORT = 3001;
const PROBE_PATHS  = ['/', '/health', '/api/health'];

export interface HealthResult {
  healthy:   boolean;
  port:      number;
  status?:   number;
  latencyMs: number;
  probedUrl: string;
  error?:    string;
}

export const checkServerHealthTool: ToolDefinition = {
  name:        'check_server_health',
  category:    'verifier',
  description: 'Probe the dev server via HTTP GET to verify it is live and responding.',
  inputSchema: {
    runId: { type: 'string', description: 'Execution run ID',         required: false },
    port:  { type: 'number', description: 'Port to probe (default 3001)', required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_ONCE,

  handler: async (input, _ctx: ToolExecutionContext): Promise<HealthResult> => {
    const port  = (input.port as number | undefined) ?? DEFAULT_PORT;
    const start = Date.now();

    for (const path of PROBE_PATHS) {
      const url = `http://localhost:${port}${path}`;
      try {
        const resp = await fetch(url, {
          signal: AbortSignal.timeout(8_000),
        });
        return {
          healthy:   resp.status < 500,
          port,
          status:    resp.status,
          latencyMs: Date.now() - start,
          probedUrl: url,
        };
      } catch {
        // try next path
      }
    }

    return {
      healthy:   false,
      port,
      latencyMs: Date.now() - start,
      probedUrl: `http://localhost:${port}/`,
      error:     `No response on any probe path for port ${port}`,
    };
  },
};
