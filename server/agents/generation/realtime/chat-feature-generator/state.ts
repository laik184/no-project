import type { ChatGeneratorState } from './types.js';

export const initialChatFeatureState: ChatGeneratorState = Object.freeze({
  rooms: Object.freeze([]),
  users: Object.freeze([]),
  messages: Object.freeze([]),
  activeConnections: Object.freeze([]),
  status: 'IDLE',
  logs: Object.freeze([]),
  errors: Object.freeze([]),
});
