/**
 * user-message.ts — Constructs user message payloads.
 * Owns user-specific rules: deduplication guard, content trimming.
 */
import { sanitizeContent, validateMessageContent } from './message-validator.ts';
import type { UserMessagePayload } from '../types/message.types.ts';

export class UserMessageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserMessageError';
  }
}

/**
 * Builds a validated UserMessagePayload.
 * Throws UserMessageError if content fails validation.
 */
export function buildUserPayload(
  projectId: number,
  rawContent: string,
  runId?:     string,
): UserMessagePayload {
  const validation = validateMessageContent(rawContent);
  if (!validation.valid) {
    throw new UserMessageError(validation.errors.join('; '));
  }

  return {
    projectId,
    runId,
    content: sanitizeContent(rawContent.trim()),
  };
}

/**
 * Guard against duplicate adjacent user messages.
 * Returns true if the new content is identical to the last user message content.
 */
export function isDuplicateUserMessage(
  lastContent: string | undefined,
  newContent:  string,
): boolean {
  if (!lastContent) return false;
  return lastContent.trim() === newContent.trim();
}
