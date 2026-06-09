/**
 * server/tools/terminal/port/find-free-port-tool.ts
 * Tool: terminal_find_free_port
 *
 * Finds a free TCP port on the host. If a preferred port is available, returns it.
 * Otherwise, returns the next available port.
 */

import net                                           from 'net';
import type { ToolDefinition }                       from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';

function checkPort(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => { server.close(); resolve(true); });
    server.listen(port, '127.0.0.1');
  });
}

function findPort(preferred?: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    const bindPort = (preferred && preferred > 0) ? preferred : 0;
    server.once('error', () => {
      const fallback = net.createServer();
      fallback.once('error', reject);
      fallback.listen(0, '127.0.0.1', () => {
        const addr = fallback.address() as net.AddressInfo;
        fallback.close(() => resolve(addr.port));
      });
    });
    server.listen(bindPort, '127.0.0.1', () => {
      const addr = server.address() as net.AddressInfo;
      server.close(() => resolve(addr.port));
    });
  });
}

export const findFreePortTool: ToolDefinition = {
  name:        'terminal_find_free_port',
  category:    'terminal',
  description: 'Find a free TCP port. Returns the preferred port if available, otherwise a random free port.',
  inputSchema: {
    preferred: { type: 'number', description: 'Preferred port number (e.g. 3000)', required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input) => {
    const preferred = input.preferred ? Number(input.preferred) : undefined;
    try {
      const port = await findPort(preferred);
      return { port, available: true };
    } catch {
      return { port: 0, available: false, error: 'No free port found' };
    }
  },
};
