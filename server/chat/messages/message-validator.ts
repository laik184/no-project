/**
 * message-validator.ts — Validates message content before persistence.
 * Pure validation — no I/O, no side effects.
 */
import { MAX_MESSAGE_LENGTH } from '../constants/chat.constants.ts';

export interface ValidationResult {
  valid:   boolean;
  errors:  string[];
}

export function validateMessageContent(content: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof content !== 'string') {
    errors.push('Message content must be a string');
    return { valid: false, errors };
  }

  const trimmed = content.trim();

  if (trimmed.length === 0) {
    errors.push('Message content cannot be empty');
  }

  if (content.length > MAX_MESSAGE_LENGTH) {
    errors.push(`Message content exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`);
  }

  return { valid: errors.length === 0, errors };
}

export function validateRole(role: unknown): ValidationResult {
  const allowed = ['user', 'assistant', 'system', 'tool'];
  const errors: string[] = [];

  if (typeof role !== 'string' || !allowed.includes(role)) {
    errors.push(`Role must be one of: ${allowed.join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
}

export function sanitizeContent(content: string): string {
  // Remove null bytes — they cause issues with PostgreSQL text columns.
  return content.replace(/\0/g, '');
}
