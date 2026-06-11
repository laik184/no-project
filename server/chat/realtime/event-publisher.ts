import { bus } from '../../infrastructure/index.ts';

const RUN_LIFECYCLE_STATUS: Record<string, string> = {
  'chat.run.started':   'started',
  'chat.run.completed': 'completed',
  'chat.run.failed':    'failed',
  'chat.run.cancelled': 'cancelled',
  'run.started':        'started',
  'run.completed':      'completed',
  'run.failed':         'failed',
  'run.cancelled':      'cancelled',
};

function publishLifecycleMirror(event: Record<string, unknown>): void {
  const type = String(event.eventType ?? event.type ?? '');
  const status = RUN_LIFECYCLE_STATUS[type];
  if (!status) return;

  bus.emit('run.lifecycle', {
    ...event,
    eventType: type,
    type,
    status,
    payload: {
      ...(event.payload && typeof event.payload === 'object' ? event.payload as Record<string, unknown> : {}),
      status,
    },
  });
}

export type PublishableEvent = Record<string, unknown>;

export const eventPublisher = {
  publish(event: object): void {
    const payload = event as Record<string, unknown>;
    bus.emit('agent.event', payload);
    publishLifecycleMirror(payload);
  },

  publishRaw(payload: Record<string, unknown>): void {
    bus.emit('agent.event', payload);
    publishLifecycleMirror(payload);
  },
};
