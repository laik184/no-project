import { EventPayload } from '../types.js';

const MAX_EVENT_NAME = 80;
const MAX_PAYLOAD_BYTES = 32_768;

export const validatePayload = (payload: EventPayload): { valid: boolean; error?: string } => {
  if (!payload.connectionId) return { valid: false, error: 'Missing connectionId' };
  if (!payload.event) return { valid: false, error: 'Missing event name' };
  if (payload.event.length > MAX_EVENT_NAME) return { valid: false, error: 'Event name too long' };

  const size = Buffer.byteLength(JSON.stringify(payload.data ?? null), 'utf8');
  if (size > MAX_PAYLOAD_BYTES) return { valid: false, error: 'Payload too large' };

  return { valid: true };
};
