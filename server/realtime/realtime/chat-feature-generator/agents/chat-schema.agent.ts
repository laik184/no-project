import type { ChatFeatureContext, GeneratedModule } from '../types.js';
import { createId } from '../utils/id-generator.util.js';

export function generateChatSchemaModule(context: ChatFeatureContext): GeneratedModule {
  const moduleId = createId('schema');

  return Object.freeze({
    name: `chat-schema.${moduleId}`,
    layer: 'L2',
    runtime: 'backend',
    code: `// generated at ${context.nowIso}
export const ChatRoomSchema = {
  id: 'string',
  name: 'string',
  createdAt: 'string',
  memberIds: 'string[]'
};

export const ChatMessageSchema = {
  id: 'string',
  roomId: 'string',
  senderId: 'string',
  content: 'string',
  sentAt: 'string',
  readBy: 'string[]'
};`,
  });
}
