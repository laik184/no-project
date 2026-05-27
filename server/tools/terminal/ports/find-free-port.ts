import net from 'net';
import type { ToolDefinition } from '../../registry/tool-types.ts';

export async function isPortInUse(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => { server.close(); resolve(false); });
    server.listen(port, host);
  });
}

export async function findFreePort(start = 4000, end = 9999): Promise<number> {
  for (let port = start; port <= end; port++) {
    if (!(await isPortInUse(port))) return port;
  }
  throw new Error(`[find-free-port] No free port in range ${start}-${end}`);
}

export const findFreePortTool: ToolDefinition = {
  name: 'find_free_port', category: 'terminal',
  description: 'Find a free port in a range',
  inputSchema: {
    start: { type: 'number', description: 'Start of range' },
    end:   { type: 'number', description: 'End of range' },
  },
  permissions: ['process'], timeoutMs: 10_000,
  retry: { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (input: Record<string, unknown>) =>
    ({ port: await findFreePort(Number(input.start ?? 4000), Number(input.end ?? 9999)) }),
};
