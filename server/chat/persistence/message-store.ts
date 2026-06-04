/**
 * message-store.ts — Delegates to messageRepository.
 * Kept for backward-compat. Import messageRepository directly for new code.
 */
import { messageRepository } from '../../repositories/chat/message.repository.ts';

export type {
  ChatMessageRecord,
  AssistantMessagePayload,
  UserMessagePayload,
  SystemMessagePayload,
} from '../types/message.types.ts';

export const messageStore = messageRepository;
