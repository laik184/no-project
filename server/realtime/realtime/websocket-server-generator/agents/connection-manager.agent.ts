import { websocketGeneratorState } from '../state.js';
import { SocketConnection } from '../types.js';
import { generateSocketId } from '../utils/id-generator.util.js';
import { logError, logMessage } from '../utils/logger.util.js';

interface ConnectionInput {
  userId?: string;
  metadata?: Record<string, unknown>;
  namespace: string;
  maxConnections: number;
}

export const connectionManagerAgent = (input: ConnectionInput): SocketConnection => {
  if (websocketGeneratorState.activeConnections.length >= input.maxConnections) {
    const message = `Connection limit reached (${input.maxConnections})`;
    logError('ws-connection', message);
    throw new Error(message);
  }

  const targetNamespace = websocketGeneratorState.namespaces.find((item) => item.name === input.namespace);
  if (!targetNamespace) {
    const message = `Namespace not found: ${input.namespace}`;
    logError('ws-connection', message);
    throw new Error(message);
  }

  const connection: SocketConnection = {
    id: generateSocketId(),
    userId: input.userId,
    namespace: input.namespace,
    rooms: new Set<string>(),
    connectedAt: Date.now(),
    lastEventAt: Date.now(),
    metadata: input.metadata,
  };

  websocketGeneratorState.activeConnections.push(connection);
  targetNamespace.connectionIds.add(connection.id);
  logMessage('ws-connection', `Connection opened: ${connection.id} namespace=${connection.namespace}`);
  return connection;
};
