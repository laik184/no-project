import { ServerConfig } from '../types.js';

const DEFAULT_NAMESPACES = ['/'];

export const resolveSocketConfig = (config: ServerConfig): Required<Omit<ServerConfig, 'tokenValidator' | 'createServer' | 'closeServer' | 'jwtSecret'>> & Pick<ServerConfig, 'tokenValidator' | 'createServer' | 'closeServer' | 'jwtSecret'> => {
  return {
    port: config.port,
    provider: config.provider ?? 'custom',
    jwtSecret: config.jwtSecret,
    allowAnonymous: config.allowAnonymous ?? false,
    maxConnections: config.maxConnections ?? 1000,
    spamWindowMs: config.spamWindowMs ?? 10_000,
    spamMaxEvents: config.spamMaxEvents ?? 30,
    namespaces: config.namespaces?.length ? config.namespaces : DEFAULT_NAMESPACES,
    tokenValidator: config.tokenValidator,
    createServer: config.createServer,
    closeServer: config.closeServer,
  };
};
