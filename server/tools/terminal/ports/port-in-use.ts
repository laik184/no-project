import { isPortInUse } from './find-free-port.ts';
import type { ToolDefinition } from '../../registry/tool-types.ts';

export { isPortInUse };

export const portInUseTool: ToolDefinition = {
  name: 'port_in_use', category: 'terminal',
  description: 'Check if a port is currently in use',
  inputSchema: { port: { type: 'number', description: 'Port to check', required: true } },
  permissions: ['process'], timeoutMs: 3_000,
  retry: { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (input: Record<string, unknown>) => ({ inUse: await isPortInUse(Number(input.port)) }),
};
