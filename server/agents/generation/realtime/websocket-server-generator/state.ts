import { Namespace, Room, SocketConnection } from './types.js';

interface WebSocketGeneratorState {
  server: unknown | null;
  activeConnections: SocketConnection[];
  rooms: Record<string, Room>;
  namespaces: Namespace[];
  status: 'INIT' | 'RUNNING' | 'ERROR';
  logs: string[];
  errors: string[];
}

export const websocketGeneratorState: WebSocketGeneratorState = {
  server: null,
  activeConnections: [],
  rooms: {},
  namespaces: [],
  status: 'INIT',
  logs: [],
  errors: [],
};

export const resetWebSocketGeneratorState = (): void => {
  websocketGeneratorState.server = null;
  websocketGeneratorState.activeConnections = [];
  websocketGeneratorState.rooms = {};
  websocketGeneratorState.namespaces = [];
  websocketGeneratorState.status = 'INIT';
  websocketGeneratorState.logs = [];
  websocketGeneratorState.errors = [];
};
