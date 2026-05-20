import { EventPayload } from '../types.js';

export const parseIncomingEvent = (input: Partial<EventPayload> & { event?: string; connectionId?: string }): EventPayload => {
  return {
    event: String(input.event ?? '').trim(),
    data: input.data,
    room: input.room,
    namespace: input.namespace,
    connectionId: String(input.connectionId ?? '').trim(),
    timestamp: typeof input.timestamp === 'number' ? input.timestamp : Date.now(),
  };
};
