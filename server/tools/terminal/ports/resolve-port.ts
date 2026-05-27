import { portRegistry }  from '../../../agents/terminal/ports/port-registry.ts';
import { findFreePort }  from './find-free-port.ts';
import type { ToolDefinition } from '../../registry/tool-types.ts';

export async function resolvePort(runId: string, projectId: string): Promise<number> {
  const existing = portRegistry.getByRun(runId);
  if (existing.length > 0) return existing[0].port;
  const port = await findFreePort();
  portRegistry.reserve(port, runId, projectId);
  return port;
}

export const resolvePortTool: ToolDefinition = {
  name: 'resolve_port', category: 'terminal',
  description: 'Resolve or allocate a port for a run',
  inputSchema: {
    runId:     { type: 'string', description: 'Run ID',     required: true },
    projectId: { type: 'string', description: 'Project ID', required: true },
  },
  permissions: ['process'], timeoutMs: 5_000,
  retry: { maxAttempts: 2, delayMs: 500, backoff: 'linear' },
  handler: async (input: Record<string, unknown>) =>
    ({ port: await resolvePort(input.runId as string, input.projectId as string) }),
};
