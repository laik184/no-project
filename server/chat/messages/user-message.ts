import { sanitizeContent, validateMessageContent } from './message-validator.ts';
import type { UserMessagePayload } from '../types/message.types.ts';

export class UserMessageError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'UserMessageError';
  }
}

export function buildUserPayload(
  projectId:  number,
  rawContent: string,
  runId?:     string,
): UserMessagePayload {
  const content = sanitizeContent(rawContent);
  const { valid, errors } = validateMessageContent(content);
  if (!valid) throw new UserMessageError(errors.join('; '), 'INVALID_CONTENT');
  return { projectId, content, runId };
}

export function isDuplicateUserMessage(lastContent: string, newContent: string): boolean {
  return lastContent.trim() === newContent.trim();
}
