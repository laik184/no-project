import type { SocketEvent } from '../types.js';

export function mapEventName(event: SocketEvent): string {
  return `chat:${event.event}`;
}

export function toEventPayload<TPayload>(event: SocketEvent<TPayload>): Readonly<Record<string, unknown>> {
  return Object.freeze({
    roomId: event.roomId,
    userId: event.userId,
    payload: event.payload,
    timestamp: event.timestamp,
  });
}
