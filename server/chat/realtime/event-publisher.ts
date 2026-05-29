/**
 * event-publisher.ts — Publishes chat domain events to the infrastructure bus.
 * Single responsibility: wrap bus.emit with typed chat-domain payloads.
 * ONLY publishes to the "agent.event" bus key (the hub fan-out handles SSE).
 */
import { bus } from '../../infrastructure/events/bus.ts';
import type { AnyChatEvent } from '../events/chat.events.ts';
import type { QuestionAskedEvent, QuestionAnsweredEvent } from '../events/question.events.ts';
import type { TimelinePublishedEvent } from '../events/timeline.events.ts';
import type {
  RunStartedEvent,
  RunCompletedEvent,
  RunFailedEvent,
  StreamStartedEvent,
  StreamTokenEvent,
  StreamEndedEvent,
} from '../types/event.types.ts';

type PublishableEvent =
  | AnyChatEvent
  | QuestionAskedEvent
  | QuestionAnsweredEvent
  | TimelinePublishedEvent
  | RunStartedEvent
  | RunCompletedEvent
  | RunFailedEvent
  | StreamStartedEvent
  | StreamTokenEvent
  | StreamEndedEvent
  | Record<string, unknown>;

export const eventPublisher = {
  /**
   * Publish a typed chat event onto the infrastructure bus.
   * The subscription-manager in infrastructure/events/ fans it out to SSE clients.
   */
  publish(event: PublishableEvent): void {
    bus.emit('agent.event', event as never);
  },

  /**
   * Publish a raw agent-event-shaped payload (wraps bus.emit directly).
   * Use when bridging infra bus events into chat-domain consumers.
   */
  publishRaw(payload: Record<string, unknown>): void {
    bus.emit('agent.event', payload as never);
  },
};
