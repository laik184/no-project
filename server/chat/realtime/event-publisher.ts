import { bus } from '../../infrastructure/index.ts';

export type PublishableEvent = Record<string, unknown>;

export const eventPublisher = {
  publish(event: PublishableEvent): void {
    bus.emit('agent.event', event);
  },

  publishRaw(payload: Record<string, unknown>): void {
    bus.emit('agent.event', payload);
  },
};
