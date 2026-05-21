/**
 * server/telemetry/telemetry-collector.ts
 * Collects and stores telemetry events from the bus.
 * Single responsibility: event ingestion and storage. No analysis logic.
 */

import { v4 as uuid }          from "uuid";
import { bus }                 from "../infrastructure/events/bus.ts";
import type { TelemetryEvent, TelemetryEventType, TelemetrySeverity } from "./types.ts";

const MAX_EVENTS_PER_RUN = 1000;
const eventStore = new Map<string, TelemetryEvent[]>();   // keyed by runId

// ── Severity mapping ──────────────────────────────────────────────────────────

const SEVERITY_MAP: Partial<Record<TelemetryEventType, TelemetrySeverity>> = {
  "policy.blocked":       "warn",
  "sandbox.blocked":      "warn",
  "verifier.failed":      "error",
  "browser.failed":       "error",
  "runtime.crashed":      "critical",
  "hallucination.detected": "critical",
  "completion.rejected":  "error",
  "security.violation":   "critical",
  "recovery.triggered":   "warn",
  "retry.triggered":      "warn",
};

function getSeverity(type: TelemetryEventType): TelemetrySeverity {
  return SEVERITY_MAP[type] ?? "info";
}

// ── Public API ────────────────────────────────────────────────────────────────

export function record(
  type:      TelemetryEventType,
  runId:     string,
  projectId: number,
  payload:   Record<string, unknown>,
  tags:      string[] = [],
  phase?:    string,
): TelemetryEvent {
  const event: TelemetryEvent = {
    id:        uuid(),
    type,
    severity:  getSeverity(type),
    runId,
    projectId,
    ts:        Date.now(),
    phase,
    payload,
    tags,
  };

  const store = eventStore.get(runId) ?? [];
  if (store.length < MAX_EVENTS_PER_RUN) store.push(event);
  eventStore.set(runId, store);

  return event;
}

export function getEvents(runId: string): TelemetryEvent[] {
  return eventStore.get(runId) ?? [];
}

export function clearEvents(runId: string): void {
  eventStore.delete(runId);
}

// ── Bus wiring ────────────────────────────────────────────────────────────────

export function wireTelemetryBus(): void {
  bus.on("agent.event", (e: any) => {
    if (!e?.runId) return;
    const type = e.eventType as TelemetryEventType;
    if (type) record(type, e.runId, e.projectId ?? 0, e.payload ?? {}, [], e.phase);
  });
}
