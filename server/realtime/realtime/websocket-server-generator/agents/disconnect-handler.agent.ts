import { websocketGeneratorState } from '../state.js';
import { logMessage } from '../utils/logger.util.js';

export const disconnectHandlerAgent = (connectionId: string): boolean => {
  const index = websocketGeneratorState.activeConnections.findIndex((item) => item.id === connectionId);
  if (index === -1) return false;

  const [connection] = websocketGeneratorState.activeConnections.splice(index, 1);

  for (const roomName of connection.rooms) {
    const room = websocketGeneratorState.rooms[roomName];
    if (!room) continue;

    room.members.delete(connectionId);
    if (room.members.size === 0) {
      delete websocketGeneratorState.rooms[roomName];
    }
  }

  const namespace = websocketGeneratorState.namespaces.find((item) => item.name === connection.namespace);
  namespace?.connectionIds.delete(connectionId);

  logMessage('ws-disconnect', `Connection closed: ${connectionId}`);
  return true;
};
