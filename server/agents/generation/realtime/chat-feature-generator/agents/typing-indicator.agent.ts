import type { ChatFeatureContext, GeneratedModule } from '../types.js';
import { createId } from '../utils/id-generator.util.js';

export function generateTypingIndicatorModule(context: ChatFeatureContext): GeneratedModule {
  const moduleId = createId('typing-indicator');

  return Object.freeze({
    name: `typing-indicator.${moduleId}`,
    layer: 'L2',
    runtime: 'backend',
    code: `// generated at ${context.nowIso}
export function emitTypingState(io, payload) {
  io.to(payload.roomId).emit('chat:typing.updated', {
    roomId: payload.roomId,
    userId: payload.userId,
    isTyping: payload.isTyping,
    updatedAt: new Date().toISOString()
  });
}`,
  });
}
