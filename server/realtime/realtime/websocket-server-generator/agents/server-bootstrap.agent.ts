import { websocketGeneratorState } from '../state.js';
import { ServerConfig } from '../types.js';
import { logError, logMessage } from '../utils/logger.util.js';

export const serverBootstrapAgent = async (config: ServerConfig): Promise<unknown> => {
  try {
    const server = config.createServer
      ? await config.createServer(config)
      : {
          provider: config.provider ?? 'custom',
          port: config.port,
          startedAt: Date.now(),
        };

    websocketGeneratorState.server = server;
    websocketGeneratorState.status = 'RUNNING';
    logMessage('ws-bootstrap', `WebSocket server bootstrapped on port ${config.port}`);
    return server;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    websocketGeneratorState.status = 'ERROR';
    logError('ws-bootstrap', `Server bootstrap failed: ${message}`);
    throw error;
  }
};
