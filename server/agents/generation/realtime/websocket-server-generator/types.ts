export interface SocketConnection {
  id: string;
  userId?: string;
  namespace: string;
  rooms: Set<string>;
  connectedAt: number;
  lastEventAt: number;
  metadata?: Record<string, unknown>;
}

export interface EventPayload<T = unknown> {
  event: string;
  data: T;
  room?: string;
  namespace?: string;
  connectionId: string;
  timestamp: number;
}

export interface Room {
  name: string;
  members: Set<string>;
  createdAt: number;
}

export interface Namespace {
  name: string;
  connectionIds: Set<string>;
}

export interface ServerConfig {
  port: number;
  provider?: 'socket.io' | 'ws' | 'custom';
  jwtSecret?: string;
  allowAnonymous?: boolean;
  maxConnections?: number;
  spamWindowMs?: number;
  spamMaxEvents?: number;
  namespaces?: string[];
  tokenValidator?: (token: string) => Promise<{ userId: string; metadata?: Record<string, unknown> } | null>;
  createServer?: (config: ServerConfig) => Promise<unknown> | unknown;
  closeServer?: (server: unknown) => Promise<void> | void;
}

export interface WebSocketGeneratorOutput {
  success: boolean;
  serverStarted: boolean;
  activeConnections: number;
  logs: string[];
  error?: string;
}
