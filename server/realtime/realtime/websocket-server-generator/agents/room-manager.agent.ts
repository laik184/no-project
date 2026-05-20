import { websocketGeneratorState } from '../state.js';
import { Room } from '../types.js';
import { logMessage } from '../utils/logger.util.js';

const getConnection = (connectionId: string) => {
  const connection = websocketGeneratorState.activeConnections.find((item) => item.id === connectionId);
  if (!connection) throw new Error('Connection not found');
  return connection;
};

export const createRoom = (name: string): Room => {
  if (!websocketGeneratorState.rooms[name]) {
    websocketGeneratorState.rooms[name] = {
      name,
      members: new Set<string>(),
      createdAt: Date.now(),
    };
    logMessage('ws-room', `Room created: ${name}`);
  }

  return websocketGeneratorState.rooms[name];
};

export const joinRoom = (connectionId: string, roomName: string): Room => {
  const connection = getConnection(connectionId);
  const room = createRoom(roomName);
  room.members.add(connectionId);
  connection.rooms.add(roomName);
  logMessage('ws-room', `Connection ${connectionId} joined room ${roomName}`);
  return room;
};

export const leaveRoom = (connectionId: string, roomName: string): Room | null => {
  const connection = getConnection(connectionId);
  const room = websocketGeneratorState.rooms[roomName];
  if (!room) return null;

  room.members.delete(connectionId);
  connection.rooms.delete(roomName);
  logMessage('ws-room', `Connection ${connectionId} left room ${roomName}`);

  if (room.members.size === 0) {
    delete websocketGeneratorState.rooms[roomName];
    logMessage('ws-room', `Room removed (empty): ${roomName}`);
    return null;
  }

  return room;
};
