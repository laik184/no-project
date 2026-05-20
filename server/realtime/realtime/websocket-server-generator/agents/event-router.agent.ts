import { websocketGeneratorState } from '../state.js';
import { EventPayload } from '../types.js';
import { parseIncomingEvent } from '../utils/event-parser.util.js';
import { logError, logMessage } from '../utils/logger.util.js';
import { validatePayload } from '../utils/payload-validator.util.js';

const rateLimitBuckets = new Map<string, number[]>();

interface EventRouterInput {
  payload: Partial<EventPayload> & { event?: string; connectionId?: string };
  spamWindowMs: number;
  spamMaxEvents: number;
}

export const eventRouterAgent = (input: EventRouterInput): EventPayload => {
  const payload = parseIncomingEvent(input.payload);
  const validation = validatePayload(payload);
  if (!validation.valid) {
    logError('ws-event', `Rejected event: ${validation.error}`);
    throw new Error(validation.error);
  }

  const now = Date.now();
  const history = rateLimitBuckets.get(payload.connectionId) ?? [];
  const activeWindow = history.filter((timestamp) => now - timestamp <= input.spamWindowMs);
  if (activeWindow.length >= input.spamMaxEvents) {
    logError('ws-event', `Spam prevention triggered for connection=${payload.connectionId}`);
    throw new Error('Rate limit exceeded');
  }

  activeWindow.push(now);
  rateLimitBuckets.set(payload.connectionId, activeWindow);

  const connection = websocketGeneratorState.activeConnections.find((item) => item.id === payload.connectionId);
  if (!connection) {
    throw new Error('Connection does not exist');
  }

  connection.lastEventAt = now;
  logMessage('ws-event', `Event routed event=${payload.event} connection=${payload.connectionId}`);
  return payload;
};
