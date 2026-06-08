import { bus } from '../../infrastructure/index.ts';

export type PublishableEvent = Record<string, unknown>;

export const eventPublisher = {
  publish(event: object): void {
    bus.emit('agent.event', event as Record<string, unknown>);
  },

  publishRaw(payload: Record<string, unknown>): void {
    bus.emit('agent.event', payload);
  },
};
