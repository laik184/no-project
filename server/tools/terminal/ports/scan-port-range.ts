import { isPortInUse } from './find-free-port.ts';
import type { ToolDefinition } from '../../registry/tool-types.ts';

export async function scanPortRange(start: number, end: number): Promise<number[]> {
  const results = await Promise.all(
    Array.from({ length: end - start + 1 }, (_, i) => start + i).map(async (p) =>
      (await isPortInUse(p)) ? p : null,
    ),
  );
  return results.filter((p): p is number => p !== null).sort((a, b) => a - b);
}

export const scanPortRangeTool: ToolDefinition = {
  name: 'scan_port_range', category: 'terminal',
  description: 'Scan a range of ports and return those in use',
  inputSchema: {
    start: { type: 'number', description: 'Start port', required: true },
    end:   { type: 'number', description: 'End port',   required: true },
  },
  permissions: ['process'], timeoutMs: 30_000,
  retry: { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (input: Record<string, unknown>) =>
    ({ ports: await scanPortRange(Number(input.start), Number(input.end)) }),
};
