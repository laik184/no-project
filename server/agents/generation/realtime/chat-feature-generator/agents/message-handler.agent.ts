import type { ChatFeatureContext, GeneratedModule } from '../types.js';
import { createId } from '../utils/id-generator.util.js';

export function generateMessageHandlerModule(context: ChatFeatureContext): GeneratedModule {
  const moduleId = createId('message-handler');

  return Object.freeze({
    name: `message-handler.${moduleId}`,
    layer: 'L2',
    runtime: 'backend',
    code: `// generated at ${context.nowIso}
export function onSendMessage(io, socket, payload) {
  const message = {
    id: payload.id,
    roomId: payload.roomId,
    senderId: payload.senderId,
    content: payload.content,
    sentAt: new Date().toISOString(),
    readBy: [payload.senderId]
  };

  io.to(payload.roomId).emit('chat:message.received', message);
  return message;
}`,
  });
}
