import type { ChatFeatureContext, GeneratedModule } from '../types.js';
import { createId } from '../utils/id-generator.util.js';

export function generateEventDispatcherModule(context: ChatFeatureContext): GeneratedModule {
  const moduleId = createId('event-dispatcher');

  return Object.freeze({
    name: `event-dispatcher.${moduleId}`,
    layer: 'L2',
    runtime: 'backend',
    code: `// generated at ${context.nowIso}
export function registerChatEvents(io, socket, handlers) {
  socket.on('chat:message.send', (payload) => handlers.onSend(io, socket, payload));
  socket.on('chat:room.join', (payload) => handlers.onJoinRoom(socket, payload.roomId));
  socket.on('chat:typing.start', (payload) => handlers.onTyping(io, payload));
  socket.on('chat:message.read', (payload) => handlers.onRead(io, payload));
}`,
  });
}
