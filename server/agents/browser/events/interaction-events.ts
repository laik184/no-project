/**
 * interaction-events.ts
 * Emit helpers for DOM interaction events via the browser local bus.
 */

import { EventEmitter } from 'events';

export interface InteractionEventMap {
  'interaction.click':       { runId: string; selector: string; success: boolean; durationMs: number; timestamp: Date };
  'interaction.fill':        { runId: string; selector: string; success: boolean; durationMs: number; timestamp: Date };
  'interaction.select':      { runId: string; selector: string; value: string; success: boolean; timestamp: Date };
  'interaction.failed':      { runId: string; action: string; selector?: string; error: string; timestamp: Date };
  'element.not.found':       { runId: string; selector: string; timeoutMs: number; timestamp: Date };
}

export type InteractionEventName = keyof InteractionEventMap;

class TypedInteractionEmitter extends EventEmitter {
  emit<K extends InteractionEventName>(event: K, payload: InteractionEventMap[K]): boolean {
    return super.emit(event, payload);
  }
  on<K extends InteractionEventName>(event: K, listener: (p: InteractionEventMap[K]) => void): this {
    return super.on(event, listener);
  }
  off<K extends InteractionEventName>(event: K, listener: (p: InteractionEventMap[K]) => void): this {
    return super.off(event, listener);
  }
}

export const interactionBus = new TypedInteractionEmitter();
interactionBus.setMaxListeners(20);

export function emitClickResult(
  runId: string, selector: string, success: boolean, durationMs: number,
): void {
  interactionBus.emit('interaction.click', { runId, selector, success, durationMs, timestamp: new Date() });
}

export function emitFillResult(
  runId: string, selector: string, success: boolean, durationMs: number,
): void {
  interactionBus.emit('interaction.fill', { runId, selector, success, durationMs, timestamp: new Date() });
}

export function emitSelectResult(
  runId: string, selector: string, value: string, success: boolean,
): void {
  interactionBus.emit('interaction.select', { runId, selector, value, success, timestamp: new Date() });
}

export function emitInteractionFailed(
  runId: string, action: string, error: string, selector?: string,
): void {
  interactionBus.emit('interaction.failed', { runId, action, selector, error, timestamp: new Date() });
}

export function emitElementNotFound(runId: string, selector: string, timeoutMs: number): void {
  interactionBus.emit('element.not.found', { runId, selector, timeoutMs, timestamp: new Date() });
}
