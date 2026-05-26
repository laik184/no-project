export interface SpanEvent {
  name: string;
  timestamp: Date;
  attributes?: Record<string, unknown>;
}

export interface Span {
  spanId: string;
  name: string;
  startedAt: Date;
  endedAt?: Date;
  durationMs?: number;
  events: SpanEvent[];
  attributes: Record<string, unknown>;
}

const spans = new Map<string, Span>();

export function recordSpanStart(spanId: string, name: string, attributes: Record<string, unknown> = {}): void {
  spans.set(spanId, { spanId, name, startedAt: new Date(), events: [], attributes });
}

export function recordSpanEnd(spanId: string): void {
  const span = spans.get(spanId);
  if (!span) return;
  span.endedAt = new Date();
  span.durationMs = span.endedAt.getTime() - span.startedAt.getTime();
}

export function addSpanEvent(spanId: string, name: string, attributes?: Record<string, unknown>): void {
  const span = spans.get(spanId);
  if (!span) return;
  span.events.push({ name, timestamp: new Date(), attributes });
}

export function getSpan(spanId: string): Span | undefined {
  return spans.get(spanId);
}

export function clearSpan(spanId: string): void {
  spans.delete(spanId);
}

export function getAllSpans(): Span[] {
  return Array.from(spans.values());
}
