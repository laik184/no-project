/**
 * test/helpers/telemetry-assert.ts
 *
 * Typed assertion helpers for verifying telemetry events in tests.
 * All assertions produce diagnostic evidence on failure.
 */

import { expect } from "vitest";

export type CapturedCall = [string, Record<string, unknown>];

// ── Bus call extractor ────────────────────────────────────────────────────────

export function agentEvents(mockEmit: { mock: { calls: unknown[] } }): Array<Record<string, unknown>> {
  return (mockEmit.mock.calls as CapturedCall[])
    .filter(([event]) => event === "agent.event")
    .map(([, payload]) => payload);
}

export function eventsOfType(
  mockEmit: { mock: { calls: unknown[] } },
  eventType: string,
): Array<Record<string, unknown>> {
  return agentEvents(mockEmit).filter(p => p.eventType === eventType);
}

// ── Assertions ────────────────────────────────────────────────────────────────

export function assertEventEmitted(
  mockEmit: { mock: { calls: unknown[] } },
  eventType: string,
  context = "",
): void {
  const events = eventsOfType(mockEmit, eventType);
  if (events.length === 0) {
    const allTypes = agentEvents(mockEmit).map(p => p.eventType);
    throw new Error(
      `[TelemetryAssert${context ? ` (${context})` : ""}] ` +
      `Expected "${eventType}" but got: [${allTypes.join(", ")}]`,
    );
  }
}

export function assertEventCount(
  mockEmit: { mock: { calls: unknown[] } },
  eventType: string,
  expected: number,
): void {
  const events = eventsOfType(mockEmit, eventType);
  expect(events).toHaveLength(expected);
}

export function assertCorrelationIdPresent(
  mockEmit: { mock: { calls: unknown[] } },
): void {
  const events = agentEvents(mockEmit);
  for (const event of events) {
    expect(event.correlationId).toBeTruthy();
  }
}

export function assertRunIdOnAllEvents(
  mockEmit: { mock: { calls: unknown[] } },
  runId: string,
): void {
  const events = agentEvents(mockEmit);
  for (const event of events) {
    expect(event.runId).toBe(runId);
  }
}

export function assertOrderedEvents(
  mockEmit: { mock: { calls: unknown[] } },
  expectedOrder: string[],
): void {
  const types = agentEvents(mockEmit).map(p => p.eventType as string);
  const indices = expectedOrder.map(t => types.indexOf(t));
  for (let i = 1; i < indices.length; i++) {
    if (indices[i - 1] === -1 || indices[i] === -1) continue;
    expect(indices[i]).toBeGreaterThan(indices[i - 1]);
  }
}

// ── Diagnostic formatter ──────────────────────────────────────────────────────

export function dumpTelemetry(mockEmit: { mock: { calls: unknown[] } }): string {
  const events = agentEvents(mockEmit);
  return events
    .map((e, i) => `  [${i}] ${e.eventType} | run=${e.runId} | cor=${e.correlationId}`)
    .join("\n");
}
