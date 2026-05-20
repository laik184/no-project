import {
  WebSocketServerController,
  startWebSocketServerOrchestrator,
  stopWebSocketServerOrchestrator,
} from './orchestrator.js';
import { websocketGeneratorState } from './state.js';
import { ServerConfig } from './types.js';

let controller: WebSocketServerController | null = null;
let lastConfig: ServerConfig | undefined;

export const startWebSocketServer = async (config: ServerConfig): Promise<WebSocketServerController> => {
  lastConfig = config;
  controller = await startWebSocketServerOrchestrator(config);
  return controller;
};

export const stopWebSocketServer = async () => {
  controller = null;
  return stopWebSocketServerOrchestrator(lastConfig);
};

export const getActiveConnections = (): number => websocketGeneratorState.activeConnections.length;

export * from './types.js';
export * from './state.js';
export * from './orchestrator.js';
