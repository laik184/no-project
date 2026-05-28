import { portRegistry } from '../state/port-registry.ts';
import type { ToolDefinition } from '../../registry/tool-types.ts';

export function getAssignedPort(runId: string): number | null {
  const allocs = portRegistry.getByRun(runId);
  return allocs.length > 0 ? allocs[0].port : null;
}

export const assignedPortTool: ToolDefinition = {
  name: 'assigned_port', category: 'terminal',
  description: 'Get the assigned port for a run',
  inputSchema: { runId: { type: 'string', description: 'Run ID', required: true } },
  permissions: ['process'], timeoutMs: 1_000,
  retry: { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (input: Record<string, unknown>) => ({ port: getAssignedPort(input.runId as string) }),
};
