import type { ChatFeatureContext, GeneratedModule } from '../types.js';
import { createId } from '../utils/id-generator.util.js';

export function generateRoomManagerModule(context: ChatFeatureContext): GeneratedModule {
  const moduleId = createId('room-manager');

  return Object.freeze({
    name: `room-manager.${moduleId}`,
    layer: 'L2',
    runtime: 'backend',
    code: `// generated at ${context.nowIso}
export function createRoom(roomStore, roomName, creatorId) {
  const room = {
    id: 'room-' + Date.now(),
    name: roomName,
    createdAt: new Date().toISOString(),
    memberIds: [creatorId]
  };

  roomStore.push(room);
  return room;
}

export function joinRoom(socket, roomId) {
  socket.join(roomId);
}`,
  });
}
