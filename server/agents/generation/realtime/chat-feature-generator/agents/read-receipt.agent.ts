import type { ChatFeatureContext, GeneratedModule } from '../types.js';
import { createId } from '../utils/id-generator.util.js';

export function generateReadReceiptModule(context: ChatFeatureContext): GeneratedModule {
  const moduleId = createId('read-receipt');

  return Object.freeze({
    name: `read-receipt.${moduleId}`,
    layer: 'L2',
    runtime: 'backend',
    code: `// generated at ${context.nowIso}
export function markMessageRead(io, payload) {
  io.to(payload.roomId).emit('chat:message.read.receipt', {
    messageId: payload.messageId,
    roomId: payload.roomId,
    userId: payload.userId,
    readAt: new Date().toISOString()
  });
}`,
  });
}
