/**
 * server/tools/terminal/port/port-in-use-tool.ts
 * Tool: terminal_port_in_use
 *
 * Checks if a specific TCP port is currently in use.
 */

import net                                           from 'net';
import type { ToolDefinition }                       from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';

function isPortInUse(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => { server.close(); resolve(false); });
    server.listen(port, '127.0.0.1');
  });
}

export const portInUseTool: ToolDefinition = {
  name:        'terminal_port_in_use',
  category:    'terminal',
  description: 'Check whether a TCP port is currently in use.',
  inputSchema: {
    port: { type: 'number', description: 'Port number to check', required: true },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input) => {
    const port = Number(input.port);
    if (!port || port < 1 || port > 65535) {
      return { port, inUse: false, error: 'Invalid port number' };
    }
    const inUse = await isPortInUse(port);
    return { port, inUse };
  },
};
