import { portRegistry } from '../state/port-registry.ts';
import type { ToolDefinition } from '../../registry/tool-types.ts';

export function releasePort(port: number): void {
  portRegistry.release(port);
}

export const releasePortTool: ToolDefinition = {
  name: 'release_port', category: 'terminal',
  description: 'Release a reserved port',
  inputSchema: { port: { type: 'number', description: 'Port to release', required: true } },
  permissions: ['process'], timeoutMs: 1_000,
  retry: { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (input: Record<string, unknown>) => { releasePort(Number(input.port)); return { ok: true }; },
};
