import { portRegistry } from '../../../agents/terminal/ports/port-registry.ts';
import type { ToolDefinition } from '../../registry/tool-types.ts';

export function releaseRunPorts(runId: string): void {
  portRegistry.releaseByRun(runId);
}

export const releaseRunPortsTool: ToolDefinition = {
  name: 'release_run_ports', category: 'terminal',
  description: 'Release all ports for a run',
  inputSchema: { runId: { type: 'string', description: 'Run ID', required: true } },
  permissions: ['process'], timeoutMs: 1_000,
  retry: { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (input: Record<string, unknown>) => { releaseRunPorts(input.runId as string); return { ok: true }; },
};
