import { MAX_MESSAGE_LENGTH } from '../constants/chat.constants.ts';

export function sanitizeContent(raw: string): string {
  return raw.replace(/\0/g, '').trim();
}

export function validateMessageContent(content: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!content || content.trim().length === 0) errors.push('Content cannot be empty');
  if (content.length > MAX_MESSAGE_LENGTH) errors.push(`Content exceeds ${MAX_MESSAGE_LENGTH} character limit`);
  return { valid: errors.length === 0, errors };
}
